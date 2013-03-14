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

    link.params = link.params || {};
    link.params.on = link.params.on || {};

    // TODO validate inputs: strings and trim
    var username = data.username;
    var password = data.password;
    // TODO do something with this option
    var remember = data.remember;

    if (!username || !password) {
        var errCode = username ? ERROR_MISSING_PASSWORD : ERROR_MISSING_USERNAME;
        return error(errCode, function(err) {
            send.badrequest(link, err.toString());
        });
    }

    // TODO do some transformation on the username
    username = username.split("@")[0];

    getUser(link.params, username, password, function(err, user) {

        if (err) {
            if (err.code) {
                onError(link, err, function() {
                    send.forbidden(link, err.toString());
                });
                return;
            }
            send.badrequest(link, err);
            return;
        }

        // TODO read the users in other way???
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

function onError(link, err, callback) {

    var handler = link.params.on.error;

    // no custom error handler specified
    if (!handler) {
        return callback();
    }

    api_customCode(link.session.appid, handler, function(err1, foo) {

        if (err1) {
            return callback()
        }
        foo(link, err, callback);
    });
}

function api_customCode(appId, handler, callback) {
    try {
        var modulePath = handler["module"];
        var functionName = handler["function"];
        var path = CONFIG.APPLICATION_ROOT + appId + "/" + modulePath;

        // TODO do this only in debug mode
        //      even so it is still problematic it the module caches data in RAM
        delete require.cache[path];

        var module = require(path);

        if (module[functionName]) {
            return callback(null, module[functionName]);
        }

        throw new Error("Function '" + functionName + "' not found in module: " + modulePath);

    } catch (err) {
        console.error(err);
        callback(err);
    }
}

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

    if (!params) {
        return callback(new Error("Missing operation parameters"));
    }

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
                    return callback(params.hash ? "Missing hash algorithm" : "Invalid hash algorithm");
            }

            var filter = {};
            filter[params.userkey] = username;
            filter[params.passkey] = password;

            collection.findOne(filter, function(err, doc) {

                if (err) { return callback(err); }

                if (!doc) {
                    return error(ERROR_USER_OR_PASS_NOT_VALID, callback);
                }

                callback(null, doc);
            });
        });
    });
}

function error(code, callback) {
    var message = ERRORS[code];
    var err = null;
    if (message) {
        err = new Error(message);
        err.code = code;
    } else {
        err = new Error("Unknown error");
        err.code = 1;
    }
    callback(err);
}

var ERROR_USER_OR_PASS_NOT_VALID = 101;
var ERROR_MISSING_USERNAME = 102;
var ERROR_MISSING_PASSWORD = 103;

var ERRORS = {
    "101": "User or password not valid",
    "102": "Missing username",
    "103": "Missing password"
};

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

