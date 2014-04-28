// bind and events dependencies
var Bind = require("github/jillix/bind")
  , Events = require("github/jillix/events")
  ;

/**
 * private: findValue
 *  This function searches a value in an object.
 *
 *  Arguments
 *    @parent: an object
 *    @dotNot: string
 *
 *  Returns
 *    The value that was found in the object or undefined.
 *
 *  Example
 *    findValue({
 *        a: {
 *            b: {
 *                c: 10
 *            }
 *        }
 *    }, "a.b.c") === 10 // true
 *
 * */
function findValue (parent, dotNot) {

    if (!dotNot || !parent) return undefined;

    var splits = String(dotNot).split(".")
      , value
      ;

    for (var i = 0; i < splits.length; i++) {
        value = parent[splits[i]];
        if (value === undefined) return undefined;
        if (typeof value === "object") parent = value;
    }

    return value;
}

/**
 *
 *  Login
 *  A generic login module for Mono.
 *
 * */
module.exports = function init (conf) {

    // set self and compute config
    var self = this
      , config = self.config = processConfig.call(self, conf)
      , $logout = $(self.config.ui.selectors.logout, self.dom)
      , $login = $(self.config.ui.selectors.login, self.dom)
      ;

    // hide login and logout elements
    $logout.hide();
    $login.hide();

    /**
     *
     *  login#getUserInfo
     *
     *  This function returns the user information from session
     *
     * */
    self.getUserInfo = function (callback) {
        self.link("userInfo", callback);
    };

    // call get user info
    self.getUserInfo(function (err, data) {

        // handle error
        if (err) {
            alert(err);
            return;
        }

        // set user info
        self.userInfo = data;

        // emit event
        self.emit("userInfo", data);

        // if this is true, emit ready now
        if (conf.options.readyOnUserInfo) {
            self.emit("ready");
        }

        // the user is logged in
        if (data) {

            // show logout and hide login elements
            $logout.show();
            $login.hide();

            // get user info elements
            var $userInfo = $(".userInfo", self.dom);

            // each element with data-key attribute
            $userInfo.find("[data-key]").each(function() {

                // the current element
                var $infoElem = $(this)

                    // get data-key attribute
                  , key = $infoElem.attr("data-key")
                  ;

                // the key exists
                if (key) {

                    // find the value in data and set the text
                    $infoElem.text(findValue(data, key));
                }
            });

            // show user info
            $userInfo.show();

            // logout button click handler
            $("#logoutButton", self.dom).on("click", function() {

                // call logout operation
                self.link("logout", function(err, data) {

                    // redirect
                    window.location = self.config.loginPage;
                });

                // prevent default browser behavior
                return false;
            });

            return;
        }

        // redirect to login page
        if (window.location.pathname !== self.config.loginPage && self.config.redirect) {
            window.location = self.config.loginPage;
            return;
        }

        // the user is not logged in
        $login.show();
        $logout.hide();

        // cache the form and add the submit handler
        $("form#login", self.dom).first().submit(function(e) {
            e.preventDefault();
            submitForm.call(self, $(this));
            return false;
        });
    });

    // if this is true, don't emit ready now
    if (!conf.options.readyOnUserInfo) {
        self.emit("ready");
    }

    // call events
    Events.call(self, self.config);
};

/**
 *
 * private: submitForm
 *  This function submits the login form
 *
 *  Arguments
 *    @form: the form jQuery object
 *
 * */
function submitForm(form) {

    // get self
    var self = this;

    // jQuery wrap
    var $form = $(form);

    // hide and empty the error message
    $form.find(self.config.ui.selectors.error).text("").hide();

    var data = {};

    // gather all the data in the form
    $form.find("input, textarea, select").each(function() {
        var input = $(this);
        switch (input.prop("tagName")) {
            case "INPUT":
            case "TEXTAREA":
            case "SELECT":
                if (input.attr("type") !== "checkbox") {
                    data[input.attr("name")] = input.val().trim();
                } else {
                    data[input.attr("name")] = input.prop("checked");
                }
        }
    });

    // abandon submission if username or password is missing
    if (!data.username || !data.password) {
        return;
    }

    // call the operation
    self.link("login", { data: data }, function(error, data) {

        // handle error
        if (error) {

            // get alert jQuery element
            var $alertElem = $form.find(self.config.ui.selectors.error);

            // translate error
            self.emit("message", error, function (err, res) {

                // handle error
                if (err) { return; }

                // set error
                var errMsg = res.message || error;

                // alert element exists
                if ($alertElem.length) {
                    $alertElem.text(errMsg).fadeIn();
                } else {
                    alert(errMsg);
                }
            });

            return;
        }

        // get the success page
        var successPage = self.config.successPage;

        // compute its constructor
        switch (successPage.constructor) {

            // success page is a string
            case String:
                // redirect
                window.location = successPage;
                break;

            // success page is an object
            case Object:

                // compute type
                switch (successPage.type) {

                    // "function" type
                    case "function":

                        // get the function
                        var functionToCall = findValue(window, successPage.value)

                        // does the function exist?
                        if (typeof functionToCall === "function") {

                            // call the function
                            functionToCall.call(self, {
                                data: data
                            }, function (redirectSuccessPage) {

                                // error must be handled in the custom script
                                window.location = redirectSuccessPage;
                            });
                        } else {

                            // error
                            console.error("Function " + successPage.value + "not found.");
                        }
                        break;

                    // we also accept string value
                    case "string":

                        // if value is a string
                        if (typeof successPage.value === "string") {

                            // redirect
                            window.location = successPage.value;
                        } else {

                            // show error
                            console.error("The value of successPage object must be a string");
                        }
                        break;
                }
                break;
            default:
                console.error("Not a valid successPage value. It must be a string or an object containing the type and the value.");
                break;
        }
    });
}

/**
 *
 * private: processConfig
 *  This function sets the config defaults
 *
 *  Arguments
 *    @config: the config object
 *
 *  Returns
 *    config object
 * */
function processConfig (config) {

    // get self
    var self = this;

    // set defaults
    config.options = config.options || {};
    config.loginPage = config.loginPage || "/login";
    config.successPage = config.successPage || "/";
    config.ui = config.ui || {};
    config.ui.selectors = config.ui.selectors || {};
    config.ui.selectors.error = config.ui.selectors.error || ".alert";
    config.ui.selectors.login = config.ui.selectors.login || ".login";
    config.ui.selectors.logout = config.ui.selectors.logout || ".logout";

    // return
    return config;
}
