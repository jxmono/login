var send = require(CONFIG.root + "/core/send.js").send;
var model = require(CONFIG.root + "/core/model/orient.js");
var mongo = require("mongodb");
var crypto = require("crypto");


var dataSources = {
    usersDS: {
        type: "mongo",
        db: "partnerlogin",
        collection: "users"
    },
    adminsDS: {
        type: "mongo",
        db: "partnerlogin",
        collection: "admins"
    }
}

var databases = {};


exports.login = function(link) {

    if (link.req.session.role) {
        send.badrequest(link, "You are already logged in");
        return;
    }

    var data = link.data;
    if (!data) {
        send.badrequest(link, "Missing data");
        return;
    }

    // TODO validate inputs: strings and trim
    var username = data.username;
    var password = data.password;
    // TODO do something with this option
    var remember = data.remember;

    if (!username || !password) {
        send.badrequest(link, !username ? "Missing username" : "Missing password");
        return;
    }

    // TODO do some transformation on the username
    username = username.split("@")[0];

    getUser(link.params, username, password, function(err, user) {

        if (err) {
            send.badrequest(link, err);
            return;
        }

        // TODO read thos users in other way???
        //      probably with the removal of users from orient
        var orientUser = user.l ? "user" : "admin";

        getOrientUser(link, orientUser, function(err) {

            if (err) {
                send.internalservererror(link, err);
                return;
            }

            if (orientUser === "user") {
                link.req.session.cid = user.cid;
                link.req.session.role = user.domain + "@garageplus.ch";
            } else {
                link.req.session.cid = "admin";
                link.req.session.role = username;
            }

            send.ok(link.res, {});
        });
    })
};

function getOrientUser(link, username, callback) {

    var appId = link.req.session.appid;

    // TODO we only need role from mono
    model.getUser(appId, username, function(err, user) {

        if (err || !user) {
            return callback(err || "Could not find user '" + username + "' for application: " + appId);
        }

        link.req.session.uid = user.uid;

        callback(null);
    });

}
function getUser(params, username, password, callback) {

    var dataSource = dataSources[params.ds];

    openDatabase(dataSource, function(err, db) {

        if (err) { return callback(err); }

        // callback to close the database
        var oldCallback = callback;
        callback = function(err, data) {
            db.close(function() {
                oldCallback(err, data);
            });
        }

        db.collection(dataSource.collection, function(err, collection) {

            if (err) { return callback(err); }

            // "md5-32/sha1-40/sha256-64/auto"
            switch (params.hash) {
                case "md5":
                case "sha1":
                case "sha256":
                case "sha512":
                    var hash = crypto.createHash(params.hash);
                    hash.update(password);
                    password = hash.digest("hex").toLowerCase();
                    break;
                case "none":
                    break;
                default:
                    return callback(params.hash ? "Missging hash algorithm" : "Invalid hash algorithms");
            }

            var filter = {};
            filter[params.userkey] = username;
            filter[params.passkey] = password;

            collection.findOne(filter, function(err, doc) {

                if (err) { return callback(err); }

                if (!doc) {
                    return callback("User or password not valid");
                }

                callback(null, doc);
            });
        });
    });
}

function openDatabase(dataSource, callback) {

    if (!dataSource || !dataSource.db) {
        return callback("Invalid data source.");
    }

    switch (dataSource.type) {

        case "mongo":
            // check the cache first maybe we have it already
            if (databases[dataSource.db]) {
                callback(null, databases[dataSource.db]);
                return;
            }

            // open a new connection to the database
            var server = new mongo.Server('localhost', 27017, { auto_reconnect: true, poolSize: 5 });
            var db = new mongo.Db(dataSource.db, server, { w: 0 });

            // cache this db connection
            databases[dataSource.db] = db;

            db.open(callback);
            return;

        default:
            return callback("Invalid data source type: " + dataSource.type);
    }
}

