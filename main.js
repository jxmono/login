M.wrap('bitbucket/jillix/login/dev/main.js', function (require, module, exports) {
var self;
var form;
var config;

var Bind = require("github/jillix/bind");
var Events = require("github/jillix/events");

module.exports = function init (conf) {

    self = this;
    config = conf;

    // TODO process options as function
    config.loginPage = config.loginPage || "/login";
    config.successPage = config.successPage || "/";
    config.options = config.options || {};

    self.getUserInfo = function (callback) {
        self.link("userInfo", callback);
    };

    self.getUserInfo(function (err, data) {

        if (err) {
            alert(err);
            return;
        }

        self.emit("userInfo", data);

        // the user is logged in
        if (data) {
            $(".logout", self.dom).show();
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
                    window.location = config.loginPage;
                });
                return false;
            });

            return;
        }

        if (window.location.pathname !== config.loginPage && config.redirect) {
            window.location = config.loginPage;
            return;
        }

        // the user is not logged in
        $(".login", self.dom).css("display", "block");

        // cache the form and add the submit handler
        form = $("form#login", self.dom).first();
        form.submit(function() {
            submitForm();
            return false;
        });
    });

    self.emit("ready");
    Events.call(self, config);
};

function submitForm() {

    // hide and empty the error message
    form.find(".alert").text("").hide();

    // does the user want to be remembered
    var remember = false;
    var checkbox = form.find("input[name='remember']").get(0);
    if (checkbox) {
        remember = checkbox.checked;
    }

    //searches for additionals in the config and adds them to the data sent
    var additionals = [];
    if(config.session){
        for(var key = 0; key < config.session.length; key++){
            additionals[key] = form.find("input[name='" + config.session[key] + "']").val();
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
            var alertElem = form.find(".alert");
            if (alertElem.length) {
                alertElem.text(err).fadeIn();
            } else {
                alert(err);
            }
            return;
        }

        window.location = config.successPage;
    });
}
return module; });