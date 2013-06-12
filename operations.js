var crypto = require('crypto');

exports.logout = function(link) {

    // TODO shouldn't this be fixed in Mono?
    // send no cache headers IE bug
    link.res.headers["cache-control"] = "no-cache";

    M.session.get(link, function(link) {

        if (!link.session._uid) {
            link.send(400, 'You are not logged in');
            return;
        }

        link.session.end(true, function() {
            link.send(200);
        });
    });
};

exports.userInfo = function(link) {

    // send no cache headers IE bug
    link.res.headers["cache-control"] = "no-cache";

    M.session.get(link, function(link) {

        // we intentionally do not reply with a non-200 status
        // because we want to avoid the browser showing an error
        if (!link.session._uid) {
            link.send(200);
            return;
        }

        // TODO remove critical or unnecessary data from the session
        link.send(200, link.session);
    });
};

exports.login = function(link) {

    // send no cache headers IE bug
    link.res.headers["cache-control"] = "no-cache";

    if (link.session._uid) {
        link.send(400, 'You are already logged in');
        return;
    }

    var data = link.data;
    if (!data) {
        link.send(400, 'Missing login data');
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
        return link.send(400, error(errCode).message);
    }

    getUser(link.params, username, password, function(err, user) {

        if (err) {
            if (err.code) {
                onError(link, err, function(err) {
                    link.send(403, err.toString());
                });
                return;
            }
            link.send(400, err);
            return;
        }

        getUserInfo(link, user, function(err, userInfo) {

            if (err) {
                link.send(500, 'Could not determine user information');
                return;
            }

            M.session.start(link, userInfo.rid, userInfo.uid, userInfo.locale, userInfo.data, function(err, session) {
                link.send(200);
            });
        });
    });
};

function getUserInfo(link, user, callback) {

    var handler = link.params.on.userInfo;

    // no userInfo handler specified
    if (!handler) {
        return callback('You must define a userInfo handler function(link, user, callback) { ... } where the callback returns an object of the form: { rid: …, uid: …, locale: …, data: … }. The data is an optional hash.');
    }

    api_customCode(handler, function(err, foo) {

        if (err) { return callback('Could not find the userInfo handler') }

        foo(link, user, callback);
    });
}

function onError(link, initialError, callback) {

    var handler = link.params.on.error;

    // no custom error handler specified
    if (!handler) {
        return callback(initialError);
    }

    api_customCode(handler, function(err, foo) {

        if (err) { return callback(initialError) }

        foo(link, initialError, callback);
    });
}

function api_customCode(handler, callback) {

    try {
        var modulePath = handler["module"];
        var functionName = handler["function"];
        var path = M.config.APPLICATION_ROOT + M.config.app.id + "/" + modulePath;

        // TODO do this only in debug mode
        //      even so it is still problematic it the module caches data in RAM
        delete require.cache[path];

        var module = require(path);
        var func = module[functionName];

        if (func && typeof func === "function") {
            return callback(null, func);
        }

        throw new Error("Function '" + functionName + "' not found in module: " + modulePath);

    } catch (err) {
        console.error(err);
        callback(err);
    }
}


function getUser(params, username, password, callback) {

    if (!params) {
        return callback(new Error("Missing operation parameters"));
    }

    M.datasource.resolve(params.ds, function(err, ds) {

        if (err) { return callback(err); }

        M.database.open(ds, function(err, db) {

            if (err) { return callback(err); }

            db.collection(ds.collection, function(err, collection) {

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

                collection.findOne(filter, function(err, user) {

                    if (err) { return callback(err); }

                    if (!user) {
                        return callback(error(ERROR_USER_OR_PASS_NOT_VALID));
                    }

                    callback(null, user);
                });
            });
        });
    });
}

function error(code) {
    var message = ERRORS[code];
    var err = null;
    if (message) {
        err = new Error(message);
        err.code = code;
    } else {
        err = new Error("Unknown error");
        err.code = 1;
    }
    return err;
}

var ERROR_USER_OR_PASS_NOT_VALID = 101;
var ERROR_MISSING_USERNAME = 102;
var ERROR_MISSING_PASSWORD = 103;

var ERRORS = {
    "101": "User or password not valid",
    "102": "Missing username",
    "103": "Missing password"
};

