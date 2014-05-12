var mandrill = require('mandrill-api/mandrill');
var mandrill_client = new mandrill.Mandrill('D43S5u9IlGqY1wCE2qqrRg');
var crypto = require("crypto");
var locale = {};

exports.forgot = function(link) {

    // get link data
    var data = link.data;

    // link data is missing
    if (!data) {
        link.send(400, "Missing forgot data");
        return;
    }

    // set params
    link.params = link.params || {};

    var username = (data.username || "").trim();
    delete data.username;

    // send error message if user not provided
    if (!username) {
        return link.send(400, "ERROR_MISSING_USERNAME");
    }

    // get user
    getUser(link.params, username, null, function(err, user, usersCol) {

        // handle error
        if (err) {
            link.send(400, err);
            return;
        }
        console.log(link);
        // generate the token
        var token = generateToken(10);
        var resetLink = 'http://' + link.req.headers.host + '/@/login/reset?username=' + username + '&token=' + token;


        // add the token to the user
        var updateObj = {
            $set : {}
        }
        updateObj.$set[link.params.tokenkey] = token;
        usersCol.update({ '_id': user._id }, updateObj, function (err) {

            // handle error
            if (err) {
                link.send(400, err);
                return;
            }

            // create the mail data
            var mailData = {
                template: (typeof link.params.template === 'object') ? link.params.template[link.session.locale] : link.params.template,
                receiver: username,
                sender: link.params.sender,
                mergeVars: [
                    {
                        name: 'recover_link',
                        content: resetLink
                    }
                ]
            }

            // send mail
            sendMail(mailData, function (err) {

                // handle error
                if (err) {
                    link.send(400, err);
                    return;
                }

                // operation complete
                link.send(200);
            });
        });
    }, link);
};

exports.reset = function(link) {
    // the reset form is requested
    if (link.req.method === "GET") {
        // TODO add a verification token to the URL and add it to the hidden input
        link.res.setHeader('content-type', 'text/html');
        link.send(200, '<form method="POST"><table><tr><td>New password: </td><td><input name="password" type="password"></td></tr><tr><td>Retype password: </td><td><input name="repassword" type="password"></td></tr><tr><td></td><td><button type="submit">Submit</button></td></tr><input name="token" type="hidden" value="TODO"></form>');
        return;
    }

    // the reset form is submitted
    if (link.req.method === "POST") {
        var password = (link.data.password || "").trim();
        var repassword = (link.data.repassword || "").trim();
        var token = (link.data.token || "").trim();

        if (!link.data.password) {
            var message = "Missing password";
        }
        if (link.data.password !== link.data.repassword) {
            var message = "Passwords do not match";
        }

        // TODO make some configurable regexp password policy

        // TODO get the user and check if he has the password change security token

        // TODO set the user password, delete the security token

        link.send(200, "OK");
        return;
    }

    link.send(400);
};

exports.logout = function(link) {

    // TODO shouldn't this be fixed in Mono?
    // send no cache headers IE bug
    link.res.headers["cache-control"] = "no-cache";

    M.session.get(link, function(link) {

        if (!link.session._uid) {
            link.send(400, "You are not logged in");
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
        if (link.session._rid == M.config.app.publicRole || !link.session._uid) {
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

    // already logged in
    if (link.session._rid != M.config.app.publicRole && link.session._uid) {
        link.send(400, "You are already logged in");
        return;
    }

    // get link data
    var data = link.data;

    // link data is missing
    if (!data) {
        link.send(400, "Missing login data");
        return;
    }

    // set params
    link.params = link.params || {};
    link.params.on = link.params.on || {};

    var username = (data.username || "").trim();
    delete data.username;
    var password = (data.password || "").trim();
    delete data.password;
    var additionals = data;

    // user or password not provided
    if (!username || !password) {
        // send error message
        var errMsg = username ? "ERROR_MISSING_PASSWORD" : "ERROR_MISSING_USERNAME";
        return link.send(400, errMsg);
    }

    // get user
    getUser(link.params, username, password, function(err, user) {

        // handle error
        if (err) {
            link.send(400, err);
            return;
        }

        // set user additionals
        user.additionals = additionals;

        // get user info
        getUserInfo(link, user, function(err, userInfo) {

            // handle error
            if (err) {
                link.send(403, err.message || err);
                return;
            }

            // start session
            M.session.start(link, userInfo.rid, userInfo.uid, userInfo.locale, userInfo.data, function(err, session) {

                // send user info data
                link.send(200, userInfo.data);
            });
        });
    }, link);
};

function sendMail (data, callback) {

    if (!callback) {
        callback = function () {};
    }

    if (!data) {
        callback('Missing data object!');
        return;
    }

    var template = {
        "template_name": data.template,
        "template_content": [],
        "message": {
            "to": [{
                "email": data.receiver,
                "type": "to"
            }],
            "from_email": data.sender,
            "from_name": 'Jillix Support Team',
            "global_merge_vars": data.mergeVars
        }
    };

    mandrill_client.messages.sendTemplate(template, function(result) {
        //check to see if rejected
        if (result[0].status === 'rejected' || result[0].status === 'invalid') {
            callback(result[0].reject_reason || 'Error on sending email, check if the email provided is valid');
        } else {
            callback(null);
        }
    }, function(e) {
        // Mandrill returns the error as an object with name and message keys
        console.log('A mandrill error occurred: ' + e.name + ' - ' + e.message);
        callback(e.name + ' - ' + e.message);
    });
}

function generateToken(length) {
    var token = '';
    var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

    for (var i = 0; i < length; i++) {
        token += possible.charAt(Math.floor(Math.random() * possible.length));
    }

    return token;
}

function getUserInfo(link, user, callback) {

    var handler = link.params.on.userInfo;

    // no userInfo handler specified
    if (!handler) {
        return callback("You must define a userInfo handler function(link, user, callback) { ... } where the callback returns an object of the form: { rid: …, uid: …, locale: …, data: … }. The data is an optional hash.");
    }

    api_customCode(handler, function(err, foo) {

        if (err) { return callback("Could not find the userInfo handler") }

        foo(user, link.session, callback);
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


function getUser(params, username, password, callback, link) {

    if (!params) {
        return callback(new Error("Missing operation parameters"));
    }

    M.datasource.resolve(params.ds, function(err, ds) {

        if (err) { return callback(err); }

        M.database.open(ds, function(err, db) {

            if (err) { return callback(err); }

            db.collection(ds.collection, function(err, collection) {

                if (err) { return callback(err); }

                var filter = {};
                filter[params.userkey] = new RegExp("^" + username + "$", "i");

                if (password !== null) {
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
                    filter[params.passkey] = password;
                }

                // a custom query path was provided
                if (typeof params.customQuery === "string") {

                    try {
                        // call the function
                        require(M.app.getPath() + params.customQuery)(link, params, filter, function (err, data) {

                            // handle error
                            if (err) { return callback(err); }

                            // find one
                            collection.findOne(filter, function(err, user) {

                                // handle error
                                if (err) { return callback(err); }

                                // no user
                                if (!user) {
                                    return callback("ERROR_USER_OR_PASS_NOT_VALID");
                                }

                                // user found
                                callback(null, user, collection);
                            });
                        });
                    } catch (e) {

                        // exception
                        callback(e.message);
                    }
                    return;
                }

                collection.findOne(filter, function(err, user) {

                    if (err) { return callback(err); }

                    if (!user) {
                        return callback("ERROR_USER_OR_PASS_NOT_VALID");
                    }

                    callback(null, user, collection);
                });
            });
        });
    });
}
