const Authentication = (function() {
    // This stores the current signed-in user
    let user = null;

    // This function gets the signed-in user
    const getUser = function() {
        return user;
    }

    // This function sends a sign-in request to the server
    const signin = function(username, password, onSuccess, onError) {
        // A. Preparing the user data
        const data = {
            username: username,
            password: password
        };

        // B. Sending the AJAX request to the server
        fetch("/signin", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(data)
        })
        .then((res) => res.json())
        .then((json) => {
            // F. Processing any error returned by the server
            if (json.status === "error") {
                if (onError) onError(json.error);
                return;
            }

            // H. Handling the success response from the server
            user = json.user;
            if (onSuccess) onSuccess();
        })
        .catch((error) => {
            if (onError) onError(error);
        });
    };

    // This function sends a validate request to the server
    const validate = function(onSuccess, onError) {
        // A. Sending the AJAX request to the server
        fetch("/validate", {
            method: "GET"
        })
        .then((res) => res.json())
        .then((json) => {
            // C. Processing any error returned by the server
            if (json.status === "error") {
                if (onError) onError(json.error);
                return;
            }

            // E. Handling the success response from the server
            user = json.user;
            if (onSuccess) onSuccess();
        })
        .catch((error) => {
            if (onError) onError(error);
        });
    };

    // This function sends a sign-out request to the server
    const signout = function(onSuccess, onError) {
        fetch("/signout", {
            method: "GET"
        })
        .then((res) => res.json())
        .then((json) => {
            if (json.status === "error") {
                if (onError) onError(json.error);
                return;
            }
            
            user = null;
            if (onSuccess) onSuccess();
        })
        .catch((error) => {
            if (onError) onError(error);
        });
    };

    return { getUser, signin, validate, signout };
})();
