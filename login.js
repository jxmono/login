var Bind = require("github/jillix/bind");
var Events = require("github/jillix/events");

/*
 *  e.g. findValue({
 *      a: {
 *          b: {
 *              c: 10
 *          }
 *      }
 *  }, "a.b.c") === 10 // true
 *
 * */
function findValue (parent, dotNot) {

    if (!dotNot) return undefined;
    if (!parent) return undefined;

    var splits = dotNot.split(".");
    var value;

    for (var i = 0; i < splits.length; i++) {
        value = parent[splits[i]];
        if (value === undefined) return undefined;
        if (typeof value === "object") parent = value;
    }

    return value;
}

module.exports = function init (conf) {

    var self;
    var form;
    var config;

    self = this;

    config = processConfig.call(self, conf);
    self.config = config;

    self.getUserInfo = function (callback) {
        self.link("userInfo", callback);
    };

    self.getUserInfo(function (err, data) {

        if (err) {
            alert(err);
            return;
        }
        self.userInfo = data;
        self.emit("userInfo", data);

        // the user is logged in
        if (data) {

            // show logout and hide login elements
            $(self.config.ui.selectors.logout, self.dom).show();
            $(self.config.ui.selectors.login, self.dom).hide();

            var userInfo = $(".userInfo", self.dom);
            userInfo.find("[data-key]").each(function() {
                var infoElem = $(this);
                var key = infoElem.attr("data-key");
                if (key) {
                    infoElem.text(data[key]);
                }
            });
            userInfo.show();
            $("#logoutButton", self.dom).on("click", function() {
                self.link("logout", function(err, data) {
                    window.location = self.config.loginPage;
                });
                return false;
            });

            return;
        }

        if (window.location.pathname !== self.config.loginPage && self.config.redirect) {
            window.location = self.config.loginPage;
            return;
        }

        // the user is not logged in
        $(self.config.ui.selectors.login, self.dom).show();
        $(self.config.ui.selectors.logout, self.dom).hide();

        // cache the form and add the submit handler
        form = $("form#login", self.dom).first();
        form.submit(function(e) {
            e.preventDefault();
            submitForm.call(self, form);
            return false;
        });
    });

    self.emit("ready");
    Events.call(self, self.config);
};

function submitForm(form) {

    var self = this;

    // hide and empty the error message
    form.find(self.config.ui.selectors.error).text("").hide();

    // does the user want to be remembered
    var remember = false;
    var checkbox = form.find("input[name='remember']").get(0);
    if (checkbox) {
        remember = checkbox.checked;
    }

    //searches for additionals in the config and adds them to the data sent
    var additionals = [];
    if(self.config.session){
        for(var key = 0; key < self.config.session.length; key++){
            additionals[key] = form.find("input[name='" + self.config.session[key] + "']").val();
        }
    }

    // prepare the data for the operation
    var data = {
        username: form.find("input[name='username']").val(),
        password: form.find("input[name='password']").val(),
        remember: remember,
        additionals: additionals
    };

    // call the operation
    self.link("login", { data: data }, function(error, data) {

        if (error) {
            var alertElem = form.find(self.config.ui.selectors.error);

            self.emit("message", error, function (err, res) {

                if (err) { return; }

                var errMsg = res.message || error;

                if (alertElem.length) {
                    alertElem.text(errMsg).fadeIn();
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

function processConfig (config) {

    var self = this;

    config.options = config.options || {};
    config.loginPage = config.loginPage || "/login";
    config.successPage = config.successPage || "/";
    config.ui = config.ui || {};
    config.ui.selectors = config.ui.selectors || {};
    config.ui.selectors.error = config.ui.selectors.error || ".alert";
    config.ui.selectors.login = config.ui.selectors.login || ".login";
    config.ui.selectors.logout = config.ui.selectors.logout || ".logout";

    return config;
}
