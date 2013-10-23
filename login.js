var Bind = require("github/jillix/bind");
var Events = require("github/jillix/events");

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
            $(self.config.ui.selectors.logout, self.dom).show();
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
        $(self.config.ui.selectors.login, self.dom).css("display", "block");

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
    self.link("login", { data: data }, function(err, data) {

        if (err) {
            var alertElem = form.find(self.config.ui.selectors.error);

            if (alertElem.length) {
                alertElem.text(err).fadeIn();
            } else {
                alert(err);
            }
            return;
        }

        window.location = self.config.successPage;
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

