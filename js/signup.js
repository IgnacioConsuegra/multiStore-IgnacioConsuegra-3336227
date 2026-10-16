document.addEventListener('DOMContentLoaded', () => {
    const signupForm = document.getElementById('signup-form');
    const errorMessage = document.getElementById('error-message');
    const submitBtn = document.getElementById('submit-btn');

    signupForm.addEventListener('submit', (e) => {
        e.preventDefault(); 

        errorMessage.classList.add('d-none');
        errorMessage.textContent = '';

        const name = document.getElementById('name').value.trim();
        const email = document.getElementById('email').value.trim();
        const phone = document.getElementById('phone').value.trim();
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        
        const street = document.getElementById('street').value.trim();
        const city = document.getElementById('city').value.trim();
        const state = document.getElementById('state').value.trim();
        const zipCode = document.getElementById('zipCode').value.trim();
        const country = document.getElementById('country').value.trim();

        if (password !== confirmPassword) {
            showError("Passwords do not match.");
            return;
        }

        if (password.length < 6) {
            showError("Password must be at least 6 characters long.");
            return;
        }

        let users = JSON.parse(localStorage.getItem('users')) || [];

        const emailExists = users.some(u => u.email.toLowerCase() === email.toLowerCase());
        if (emailExists) {
            showError("An account with this email already exists.");
            return;
        }

        const userData = {
            id: Date.now().toString(),
            name: name,
            email: email,
            phone: phone,
            password: password,
            address: {
                street: street,
                city: city,
                state: state,
                zipCode: zipCode,
                country: country
            },
            role: "Admin", 
            createdAt: new Date().toISOString()
        };

        submitBtn.disabled = true;
        submitBtn.textContent = 'Creating account...';

        setTimeout(() => {
            try {
                users.push(userData);
                localStorage.setItem('users', JSON.stringify(users));

                localStorage.setItem('user', JSON.stringify(userData));
                
                alert("Account created successfully!");
                
                window.location.href = "../index.html"; 

            } catch (error) {
                showError("An error occurred while saving your data.");
                submitBtn.disabled = false;
                submitBtn.textContent = 'Create Account';
            }
        }, 1000); 
    });

    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.classList.remove('d-none');
    }
});