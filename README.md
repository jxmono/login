login
=====

A generic login module.


## Operations

### `login`

Starts a session for the given user if the user credentials are correct and the user is not already logged in.

#### Request data

- `username` the login user name
- `password` the login password
- `remember` **TODO** (currently remember is on since the session expires in several days only)
- `additionals`: additional data can be sent from an extended login form (**TODO** code need improvement)

#### Response

- `200` and no data if the login was successful
- `400` if the user is already logged in or any of the `username` or `password` is missing
- `403` if the authentication failed or the user info (necessary for the building the session) could not be retrieved

### `logout`

**TODO**

### `userInfo`

**TODO**


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


## Change Log

### dev

- Add new fixed and features here

### v0.7.0

- Renamed the main file to the name of the module
- Added Events `v0.1.7` dependency
- Added skeleton documentation

