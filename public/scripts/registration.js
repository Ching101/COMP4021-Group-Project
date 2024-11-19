const Registration = (function() {
    const register = function(username, name, password, onSuccess, onError) {
        // Create user data object
        const userData = {
            username: username,
            name: name,
            password: password
        };

        // Send POST request to /register
        fetch("/register", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(userData)
        })
        .then(res => res.json())
        .then(json => {
            if (json.status === "success") {
                if (onSuccess) onSuccess();
            } else {
                if (onError) onError(json.error);
            }
        })
        .catch(err => {
            if (onError) onError("An error occurred during registration");
        });
    };

    return { register };
})();
