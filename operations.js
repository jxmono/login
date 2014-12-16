var mandrill = require('mandrill-api/mandrill');
var mandrillClient = null;
var crypto = require('crypto');
var jxutils = require('jxutils');

exports.forgot = function(link) {

    // get link data
    var data = link.data || {};

    // set params
    link.params = link.params || {};

    // get the Mandrill Api Key
    if (!link.params.mandrillKey) {
        link.send(400, 'ERROR_MISSING_MANDRILL_API_KEY');
        return;
    }

    var username = (data.username || '').trim();
    delete data.username;

    // send error message if user not provided
    if (!username) {
        return link.send(400, 'ERROR_MISSING_USERNAME');
    }

    // get user
    getUser(link.params, username, null, function(err, user, usersCol) {

        // handle error
        if (err) {
            link.send(400, err);
            return;
        }

        function userCheckCallback(err) {
            // handle error
            if (err) {
                link.send(403, err.message || err);
                return;
            }

            // generate the token
            var token = generateToken(10);
            var resetLink = 'http://' + link.req.headers.host + '/@/' + link.operation.module + '/reset?username=' + username + '&token=' + token;

            var updateObj = {
                $set : {}
            }

            // add the token to the user
            updateObj.$set[link.params.tokenkey] = token;

            usersCol.update({ _id: user._id }, updateObj, function (err) {

                if (err) { return link.send(400, err); }

                // create the mail data
                var mailData = {
                    template: (typeof link.params.template === 'object') ? link.params.template[link.session.locale] : link.params.template,
                    sender: link.params.sender,
                    mergeVars: [
                        {
                            name: 'recover_link',
                            content: resetLink
                        }
                    ]
                }

                mandrillClient = mandrillClient || new mandrill.Mandrill(link.params.mandrillKey);

                // check if a custom code for the reciver exists
                if (link.params.customReceiverHandler) {
                    M.emit(link.params.customReceiverHandler, { user: user, link: link }, function (err, receiver) {

                        if (err) { return link.send(500, err); }
                        mailData.receiver = receiver;

                        // send mail
                        sendMail(mandrillClient, mailData, function (err) {

                            if (err) { return link.send(500, err); }

                            // operation complete
                            link.send(200);
                        });
                    });
                } else {
                    mailData.receiver = username;

                    // send mail
                    sendMail(mandrillClient, mailData, function (err) {

                        if (err) { return link.send(500, err); }

                        // operation complete
                        link.send(200);
                    });
                }
            });
        }

        // no userCheck handler event specified
        if (!link.params.on || !link.params.on.userCheck) {
            userCheckCallback('You must define a userCheck handler event with handlers' +
                ' in the form of function(user, session, callback) { ... }' +
                ' where the callback will be called with an error (possibly null).');
        } else {
            M.emit(link.params.on.userCheck, user, link.session, userCheckCallback);
        }
    }, link);
};

exports.reset = function(link) {

    // the reset form is requested
    if (link.req.method === 'GET') {

        if (!link.query.token || !link.query.username) {
            return link.send(400, 'ERROR_INVALID_RESET_LINK');
        }

        // get the token and username
        var token = link.query.token;   
        var username = link.query.username;

        link.res.setHeader('content-type', 'text/html');
        link.send(200, '<form method="POST"><table><tr><td>New password: </td><td><input name="password" type="password"></td></tr><tr><td>Retype password: </td><td><input name="repassword" type="password"></td></tr><tr><td></td><td><button type="submit">Submit</button></td></tr><input name="token" type="hidden" value="' + token + '"><input name="username" type="hidden" value="' + username +'"></form>');
        return;
    }

    // the reset form is submitted
    if (link.req.method === 'POST') {
        var password = (link.data.password || '').trim();
        var repassword = (link.data.repassword || '').trim();
        var token = (link.data.token || '').trim();
        var username = (link.data.username || '').trim();

        if (!link.data.password) {
            return link.send(400, 'ERROR_MISSING_PASSWORD');
        }
        if (link.data.password !== link.data.repassword) {
            return link.send(400, 'ERROR_PASSWORDS_DO_NOT_MATCH');
        }

        // TODO make some configurable regexp password policy

        // handle hash
        switch (link.params.hash) {
            case 'md5':
            case 'sha1':
                var hash = crypto.createHash(link.params.hash);
                hash.update(password);
                password = hash.digest('hex').toLowerCase();
                break;
            case 'sha256':
            case 'sha512':
                var hash = crypto.createHash(link.params.hash);
                hash.update(password);
                password = hash.digest('hex').toLowerCase();
                break;
            case 'none':
                break;
            default:
                return link.send(400, link.params.hash ? 'ERROR_MISSING_HASH_ALGORITHM' : 'ERROR_INVALID_HASH_ALGORITHM');
        }

        // get user
        getUser(link.params, username, null, function(err, user, usersCol) {

            // handle error
            if (err) {
                link.send(400, err);
                return;
            }

            // check to see if the token matches
            if (!token || jxutils.findValue(user, link.params.tokenkey) !== token) {
                return link.send(400, 'ERROR_INVALID_RESET_TOKEN');
            }

            // change the password
            var updateObj = {
                $set: {},
                $unset: {}
            };

            // change the password
            updateObj['$set'][link.params.passkey] = password;
            // delete the security token
            updateObj['$unset'][link.params.tokenkey] = 1;

            usersCol.update({ _id: user._id }, updateObj, { multi: true }, function (err) {

                if (err) { return link.send(400, err); }

                // check if the reset on.success handler exists
                if (link.params.on.success) {
                    M.emit(link.params.on.success, { user: user, link: link });
                }

                if (link.params.resetRedirect) {
                    link.res.headers.location = 'http://' + link.req.headers.host + link.params.resetRedirect;
                    return link.send(302);
                }

                link.send(200, 'Password reset');
            });
        });
    }
};

exports.logout = function(link) {

    M.session.get(link, function(link) {

        if (!link.session._uid) {
            return link.send(400, 'ERROR_NOT_LOGGEN_IN');
        }

        link.session.end(true, function() {
            link.send(200);
        });
    });
};

exports.userInfo = function(link) {

    // send no cache headers IE bug
    link.res.headers['cache-control'] = 'no-cache';

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
    link.res.headers['cache-control'] = 'no-cache';

    // already logged in
    if (link.session._rid != M.config.app.publicRole && link.session._uid) {
        link.send(400, 'ERROR_ALREADY_LOGGEN_IN');
        return;
    }

    // get link data
    var data = link.data || {};

    // set params
    link.params = link.params || {};
    link.params.on = link.params.on || {};

    var username = (data.username || '').trim();
    delete data.username;
    var password = (data.password || '').trim();
    delete data.password;
    var additionals = data;

    // user or password not provided
    if (!username || !password) {
        return link.send(400, username ? 'ERROR_MISSING_PASSWORD' : 'ERROR_MISSING_USERNAME');
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

        function userInfoCallback(err, userInfo) {
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
        }

        if (!link.params.on || !link.params.on.userInfo) {
            userInfoCallback('You must define a userInfo handler event with handlers' +
                ' in the form of function(user, session, callback) { ... }' +
                ' where the callback will be called with an error (possibly null) and an' +
                ' object of the form: { rid: …, uid: …, locale: …, data: … }.' +
                ' The data is an optional hash.');
        } else {
            M.emit(link.params.on.userInfo, user, link.session, userInfoCallback);
        }
    }, link);
};

function sendMail (client, data, callback) {

    callback = callback || function () {};

    if (!data) {
        return callback('ERROR_MISSING_EMAIL_DATA');
    }

    var template = {
        'template_name': data.template,
        'template_content': [],
        'message': {
            'to': [{
                'email': data.receiver,
                'type': 'to'
            }],
            'from_email': data.sender,
            'from_name': 'Jillix Support Team',
            'global_merge_vars': data.mergeVars
        }
    };

    client.messages.sendTemplate(template, function(result) {
        //check to see if rejected
        if (result[0].status === 'rejected' || result[0].status === 'invalid') {
            callback(result[0].reject_reason || 'Error on sending email, check if the email address provided is valid');
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

function getUser(params, username, password, callback, link) {

    if (!params) {
        return callback(new Error('Missing operation parameters'));
    }

    M.datasource.resolve(params.ds, function(err, ds) {

        if (err) { return callback(err); }

        M.database.open(ds, function(err, db) {

            if (err) { return callback(err); }

            db.collection(ds.collection, function(err, collection) {

                if (err) { return callback(err); }

                var filter = {};
                filter[params.userkey] = new RegExp('^' + username + '$', 'i');

                if (password !== null) {
                    // 'md5-32/sha1-40/sha256-64/auto'
                    switch (params.hash) {
                        case 'md5':
                        case 'sha1':
                            var hash = crypto.createHash(params.hash);
                            hash.update(password);
                            password = hash.digest('hex').toLowerCase();
                            break;
                        case 'sha256':
                        case 'sha512':
                            var hash = crypto.createHash(params.hash);
                            hash.update(password);
                            password = hash.digest('hex').toLowerCase();
                            break;
                        case 'none':
                            break;
                        default:
                            return callback(params.hash ? 'ERROR_MISSING_HASH_ALGORITHM' : 'ERROR_INVALID_HASH_ALGORITHM');
                    }
                    filter[params.passkey] = password;
                }

                // a custom query path was provided
                if (typeof params.customQuery === 'string') {

                    try {
                        var customData = {
                            filter: filter,
                            form: {
                                username: username,
                                password: password
                            }
                        };

                        // call the function
                        require(M.app.getPath() + params.customQuery)(link, params, customData, function (err, data) {

                            // handle error
                            if (err) { return callback(err); }

                            // find one
                            collection.findOne(filter, function(err, user) {

                                // handle error
                                if (err) { return callback(err); }

                                // no user
                                if (!user) {
                                    return callback('ERROR_USER_OR_PASS_NOT_VALID');
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
                        return callback('ERROR_USER_OR_PASS_NOT_VALID');
                    }

                    callback(null, user, collection);
                });
            });
        });
    });
}

