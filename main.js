
var self;
var form;
var config;

module.exports = function init (conf) {

    self = this;
    config = conf;

    // TODO process options as function
    config.loginPage = config.loginPage || "/login";
    config.successPage = config.successPage || "/";

    self.link("userInfo", function(err, data) {

        if (err) {
            alert(err);
            return;
        }

        // the user is logged in
        if (data) {
            $(self.dom).find(".logout").show();
            var userInfo = $(self.dom).find(".userInfo");
            userInfo.find("[data-key]").each(function() {
                var infoElem = $(this);
                var key = infoElem.attr("data-key");
                if (key) {
                    infoElem.text(data[key]);
                }
            });
            userInfo.show();
            $(self.dom).find("#logoutButton").on("click", function() {
                self.link("logout", function(err, data) {
                    window.location = config.loginPage;
                });
            });

            return;
        }

        if (window.location.pathname !== config.loginPage) {
            window.location = config.loginPage;
            return;
        }

        // the user is not logged in
        $(self.dom).find(".login").show();

        // cache the form and add the submit handler
        form = $(self.dom).find("form#login").first().show();
        form.submit(function() {
            submitForm();
            return false;
        });
    });
};

function submitForm () {

    // hide and empty the error message
    form.find(".alert").text("").hide();

    // does the user want to be remembered
    var remember = false;
    var checkbox = form.find("input[name='remember']").get(0);
    if (checkbox) {
        remember = checkbox.checked;
    }

    // prepare the data for the operation
    var data = {
        username: form.find("input[name='username']").val(),
        password: form.find("input[name='password']").val(),
        remember: remember
    };

    // call the operation
    self.link("login", { data: data }, function(err, data) {

        if (err) {
            form.find(".alert").text(err).fadeIn();
            return;
        }

        window.location = config.successPage;
    });
}

