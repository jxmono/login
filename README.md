login
=====

A generic login module.


## Operations

### `login`

Starts a session for the given user if the user credentials are correct and the user is not already logged in.

#### Request data

The module HTML must contain a `form#login` which will be used for data collection. The form must contain the following named inputs:

- `username` the login user name
- `password` the login password
- any additional named input will be submitted with the request and saved into the server side user object under the `additional` key

#### Response

- `200` and no data if the login was successful
- `400` if the user is already logged in or any of the `username` or `password` is missing
- `403` if the authentication failed or the user info (necessary for the building the session) could not be retrieved

### `logout`

Ends a session for the logged in user.

### `userInfo`

Gets the user session object or `undefined` if the user is not logged in.

### `forgot`

Sends an email the user with a password reset link.

**Node:** Currently, this feature is only supported for login modules that use email addresses as user names.

### `reset`

If this operation receives a valid user name and a password reset token, it will display a simple reset password form. Upon form submission, the user password is reset.

## Custom Code

### `userInfo`

The `userInfo` configuration and handler in the application is required in order for the module to be able to be able to build the user information to be saved in the new session. This handler must have the signature:

```js
function (user, session, callback) {
    // ... compute err and userInfo
    callback(err, userInfo);
}
```

and it must return through the `callback` a user information object (if no error state is found). This object must contain:

```js
{
    rid: …, // the Mono role id (use M.app.getRole to get the role ID for a role with a given name)
    uid: …, // the user ID (application specific)
    locale: …, // the user locale (2 letter lower case language code)
    data: … // extra session data that will be saved as session.data (application specific)
}
```


## Changelog

### dev
 - Add fixes and new features here

### v0.2.0
 - Updated to Bind v0.3.1

### v0.2.0
 - Added reset password functionality implemented with the `reset` and `forgot` operations
 - Replaced most of the error messages with error codes (to be translated/properly displayed by applications)
 - Send an object containing the `filter`, the form data (object containing: `username` and `password fields) to the custom script.
 - Added `logout` method
 - Added `utils` as dependency
 - Added JSDoc comments

### v0.1.12
 - `Events v0.1.11`

### v0.1.11
 - Sending all data from the client and save it in the user server object under `additionals` key
 - `Events v0.1.10` and `Bind v0.2.2`

### v0.1.10
 - Hide login and logout elements matched by selectors on module init
 - Cleaned up the code

### v0.1.9
 - Added `readyOnUserInfo` field in `config.options`. If this is `true` the `ready` event will be emitted after the login module gets the user info.

### v0.1.8
 - Send user info data after login.

### v0.1.7
 - Handle `successPage` in object format. The `successPage` can look like:

    ```json
    {
        "scripts": ["/js/some-custom-script.js"],
        ...,
        "successPage": {
            "type": "function",
            "value": "Foo.login.computeSuccessPage"
        }
    }
    ```

    In the custom script (`some-custom-script.js`) that defines `Foo.login.computeSuccessPage` we will have:

    ```js
    window.Foo = {
        login: {
            computeSuccessPage: function (options, callback) {
                var redirectUrl = "...";
                doSomeCrudRequest(..., function (err, data) {
                    if (err) { alert(err); }
                    callback(redirectUrl);
                });
            }
        }
    };
    ```

### v0.1.6
 - Added custom query feature that can be used when searching user in database. For this you have to provide `customQuery` parameter in the `params` object:
    ```json
    {
        "ds":           "loginsDS",
        "hash":         "...",
        "userkey":      "..",
        "passkey":      "...",
        "customQuery":  "/login_custom_query",
        "on":           {...}
    }
    ```
    In the application directory you have to create `login_custom_query.js` that will export a function:

    ```js
    /*
     *  This function is called from the login module.
     *
     * */
    module.exports = function (link, params, filter, callback) {

        filter["add any field"] =  "you want";

        // do a database request, for example
        foo (function (err) {

            // handle error
            if (err) return callback (err);

            // finally callback
            callback();
        });
    };
    ```

### v0.1.5
 - `Events v0.1.8` and `Bind v0.2.1`

### v0.1.4
 - TODO

### v0.1.3
 - TODO

### v0.1.2
 - TODO

### v0.1.1

- Fixed `getUserInfo` api from v0.1.0

### v0.1.0

- **WARNING** This version has a bug in it DO NOT USE!!
- Renamed the main file to the name of the module
- Added Events `v0.1.7` dependency
- Added skeleton documentation

