document.addEventListener('DOMContentLoaded', () => {
    // Seleccionar elementos del DOM basados en la estructura proporcionada
    const loginForm = document.querySelector('form');
    const emailInput = document.querySelector('input[type="email"]');
    const passwordInput = document.querySelector('input[type="password"]');
    const submitBtn = document.querySelector('button[type="submit"]');

    // Crear dinámicamente un elemento para mostrar errores
    const errorMessage = document.createElement('div');
    errorMessage.className = 'text-danger mb-3 d-none';
    errorMessage.style.fontSize = '0.85rem';
    errorMessage.style.textAlign = 'center';
    loginForm.insertBefore(errorMessage, loginForm.firstChild);

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();

        // Limpiar mensajes de error previos
        errorMessage.classList.add('d-none');
        errorMessage.textContent = '';

        const email = emailInput.value.trim();
        const password = passwordInput.value;

        // Recuperar la base de datos de usuarios (arreglo 'users')
        const users = JSON.parse(localStorage.getItem('users')) || [];

        // Validar si existe un usuario con ese correo y contraseña
        const foundUser = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);

        if (foundUser) {
            // Deshabilitar botón para evitar múltiples envíos
            submitBtn.disabled = true;
            submitBtn.textContent = 'Signing in...';

            setTimeout(() => {
                // Guardar la información del usuario en 'user' para la sesión activa
                localStorage.setItem('user', JSON.stringify(foundUser));

                // Redirigir dependiendo del rol (ajusta las rutas según la estructura de tus carpetas)
                if (foundUser.role === 'Admin') {
                    window.location.href = 'admin.html'; 
                } else {
                    window.location.href = '../index.html'; 
                }
            }, 800); // Pequeño retraso para simular carga
        } else {
            // Credenciales incorrectas
            errorMessage.textContent = 'Correo electrónico o contraseña incorrectos.';
            errorMessage.classList.remove('d-none');
            
            // Limpiar el campo de contraseña
            passwordInput.value = '';
        }
    });
});