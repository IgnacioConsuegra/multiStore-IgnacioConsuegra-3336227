document.addEventListener('DOMContentLoaded', () => {
    const signupForm = document.getElementById('signup-form');
    const errorMessage = document.getElementById('error-message');
    const submitBtn = document.getElementById('submit-btn');

    signupForm.addEventListener('submit', (e) => {
           window.location.href = "../views/login.html"; 
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

        // 3. Crear el objeto usuario
        const userData = {
            id: Date.now().toString(), // Genera un ID simple
            name: name,
            email: email,
            phone: phone,
            password: password, // En un entorno real, las contraseñas no se guardan en texto plano
            address: {
                street: street,
                city: city,
                state: state,
                zipCode: zipCode,
                country: country
            },
            createdAt: new Date().toISOString()
        };

        // 4. Simular estado de "Cargando"
        submitBtn.disabled = true;
        submitBtn.textContent = 'Creating account...';

        // Usamos setTimeout para simular un pequeño retraso de red (opcional, para dar mejor UX)
        setTimeout(() => {
            try {
                // 5. Guardar en localStorage
                localStorage.setItem('user', JSON.stringify(userData));
                
                // 6. Redirigir o limpiar
                console.log("Usuario guardado en localStorage:", userData);
                alert("Account created successfully!");
                
                // Si tienes la página index o login, puedes redirigir así:
                // window.location.href = 'index.html'; 
                
                // Restaurar botón (por si no rediriges)
                submitBtn.disabled = false;
                submitBtn.textContent = 'Create Account';
                signupForm.reset();
                 window.location.href = "../views/login.html"; // Redirige a la página de login después de crear la cuenta

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