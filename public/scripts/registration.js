const Registration = (function () {
    const validatePassword = function (password) {
        return password.length >= 8;
    };

    const register = function (username, password, onSuccess, onError) {
        // Validate password length
        if (!validatePassword(password)) {
            if (onError) onError("Password must be at least 8 characters long");
            return;
        }

        // Create user data object
        const userData = {
            username: username,
            password: password,
        };

        // Send POST request to /register
        fetch("/register", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(userData),
        })
            .then((res) => res.json())
            .then((json) => {
                if (json.status === "success") {
                    if (onSuccess) onSuccess();
                } else {
                    if (onError) onError(json.error);
                }
            })
            .catch((err) => {
                if (onError) onError("An error occurred during registration");
            });
    };

    return { register };
})();
