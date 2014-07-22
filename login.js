// Dependencies
var Bind = require("github/jillix/bind");
var Events = require("github/jillix/events");
var Utils = require ("github/jillix/utils");

/**
 * Login
 * A generic login module for Mono.
 * Init module function. Called by Mono API.
 *
 * @name init
 * @function
 * @param {Object} conf Module config
 * @return
 */
module.exports = function init (conf) {

    // set self and compute config
    var self = this;
    var config = self.config = processConfig.call(self, conf);
    var $login = $(self.config.ui.selectors.login, self.dom);
    var $logout = $(self.config.ui.selectors.logout, self.dom);
    var $forgot = $(self.config.ui.selectors.forgot, self.dom);

    // hide login, logout, and forgot elements
    $login.hide();
    $logout.hide();
    $forgot.hide();

    $forgot.find(".forgot-link").attr("href", config.forgotPage);

    /**
     * getUserInfo
     * This function returns the user information from session
     *
     * @name getUserInfo
     * @function
     * @param {Function} callback The callback function
     * @return
     */
    self.getUserInfo = function (callback) {
        self.link("userInfo", callback);
    };

    /**
     * logout
     * Logs out the user
     *
     * @name logout
     * @function
     * @return {Boolean} Returns false
     */
    self.logout = function () {

        // call logout operation and redirect to login
        self.link("logout", function(err, data) {
            window.location = self.config.loginPage;
        });

        // prevent default browser behavior
        return false;
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
            $forgot.hide();

            // get user info elements
            var $userInfo = $(".userInfo", self.dom);

            // each element with data-key attribute
            $userInfo.find("[data-key]").each(function() {

                // the current element
                var $infoElem = $(this);
                // get data-key attribute
                var key = $infoElem.attr("data-key");

                // if the key exists find the value in data and set the text
                if (key) {
                    $infoElem.text(Utils.findValue(data, key));
                }
            });

            // show user info
            $userInfo.show();

            // logout button click handler
            $("#logoutButton", self.dom).on("click", self.logout);

            return;
        }

        // redirect to login page
        if (window.location.pathname !== self.config.loginPage && window.location.pathname !== self.config.forgotPage && self.config.redirect) {
            window.location = self.config.loginPage;
            return;
        }

        // the user is not logged in
        if (window.location.pathname === self.config.forgotPage) {
            $forgot.show();
            $login.hide();
        } else {
            $login.show();
            $forgot.hide();
        }
        $logout.hide();

        // cache the form and add the submit handler
        $("form#login", self.dom).first().submit(function(e) {
            e.preventDefault();
            submitForm.call(self, $(this));
            return false;
        });
        // cache the form and add the submit handler
        $("form#forgot", self.dom).first().submit(function(e) {
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
 * submitForm
 * This function submits the login form
 *
 * @name submitForm
 * @function
 * @param {jQuery} form Form jQuery object
 * @return
 */
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

    var isForgot = $form.attr("id") === "forgot";

    // abandon submission if username or password is missing
    if (!data.username || !isForgot && !data.password) {
        return;
    }

    // call the operation
    self.link(isForgot ? "forgot" : "login", { data: data }, function(error, data) {

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
                window.location = isForgot ? self.config.loginPage : self.config.successPage;
                break;

            // success page is an object
            case Object:

                // compute type
                switch (successPage.type) {

                    // "function" type
                    case "function":

                        // get the function
                        var functionToCall = Utils.findValue(window, successPage.value)

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
 * processConfig
 * This function sets the config defaults
 *
 * @name processConfig
 * @function
 * @param {Object} config Module configuration object
 * @return {Object} Module config
 */
function processConfig (config) {

    // get self
    var self = this;

    // set defaults
    config.options = config.options || {};
    config.loginPage = config.loginPage || "/login";
    config.successPage = config.successPage || "/";
    config.forgotPage = config.forgotPage || "/forgot";
    config.ui = config.ui || {};
    config.ui.selectors = config.ui.selectors || {};
    config.ui.selectors.error = config.ui.selectors.error || ".alert";
    config.ui.selectors.login = config.ui.selectors.login || ".login";
    config.ui.selectors.logout = config.ui.selectors.logout || ".logout";
    config.ui.selectors.forgot = config.ui.selectors.forgot || ".forgot";

    // return
    return config;
}
