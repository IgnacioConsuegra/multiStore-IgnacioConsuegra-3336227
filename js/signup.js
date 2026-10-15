document.addEventListener('DOMContentLoaded', () => {
    const signupForm = document.getElementById('signup-form');
    const errorMessage = document.getElementById('error-message');
    const submitBtn = document.getElementById('submit-btn');

    signupForm.addEventListener('submit', (e) => {
        e.preventDefault(); // Evita que la página se recargue

        // Resetear mensajes de error
        errorMessage.classList.add('d-none');
        errorMessage.textContent = '';

        // 1. Obtener valores de los inputs
        const name = document.getElementById('name').value.trim();
        const email = document.getElementById('email').value.trim();
        const phone = document.getElementById('phone').value.trim();
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        
        // Direccion
        const street = document.getElementById('street').value.trim();
        const city = document.getElementById('city').value.trim();
        const state = document.getElementById('state').value.trim();
        const zipCode = document.getElementById('zipCode').value.trim();
        const country = document.getElementById('country').value.trim();

        // 2. Validaciones básicas
        if (password !== confirmPassword) {
            showError("Passwords do not match.");
            return;
        }

        if (password.length < 6) {
            showError("Password must be at least 6 characters long.");
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
        localStorage.setItem('user', JSON.stringify(userData));

        setTimeout(() => {
            try {
                
                alert("Account created successfully!");
                
                // Si tienes la página index o login, puedes redirigir así:
                // window.location.href = 'index.html'; 
                
                // Restaurar botón (por si no rediriges)
                submitBtn.disabled = false;
                submitBtn.textContent = 'Create Account';
                signupForm.reset();
                window.location.href = "../index.html"; 

            } catch (error) {
                showError("An error occurred while saving your data.");
                submitBtn.disabled = false;
                submitBtn.textContent = 'Create Account';
            }
        }, 1000); // 1 segundo de "carga"
    });

    // Función auxiliar para mostrar errores
    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.classList.remove('d-none');
    }
});