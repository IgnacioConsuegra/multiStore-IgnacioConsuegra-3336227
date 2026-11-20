document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.querySelector('form');
    const emailInput = document.querySelector('input[type="email"]');
    const passwordInput = document.querySelector('input[type="password"]');
    const submitBtn = document.querySelector('button[type="submit"]');

    const errorMessage = document.createElement('div');
    errorMessage.className = 'text-danger mb-3 d-none';
    errorMessage.style.fontSize = '0.85rem';
    errorMessage.style.textAlign = 'center';
    loginForm.insertBefore(errorMessage, loginForm.firstChild);

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        errorMessage.classList.add('d-none');
        errorMessage.textContent = '';

        const email = emailInput.value.trim();
        const password = passwordInput.value;

        submitBtn.disabled = true;
        submitBtn.textContent = 'Signing in...';

        try {
            const response = await fetch('../backend/api/login.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const result = await response.json();

            if (response.ok && result.status === 'success') {
                // Guardamos la sesión activa en localStorage con los datos de MySQL
                localStorage.setItem('user', JSON.stringify(result.user));

                if (result.user.role === 'Admin') {
                    window.location.href = 'admin.html';
                } else {
                    window.location.href = '../index.html';
                }
            } else {
                errorMessage.textContent = result.message || 'Correo electrónico o contraseña incorrectos.';
                errorMessage.classList.remove('d-none');
                passwordInput.value = '';
                submitBtn.disabled = false;
                submitBtn.textContent = 'Sign in';
            }
        } catch (error) {
            console.error('Error en login:', error);
            errorMessage.textContent = 'Error de conexión con el servidor.';
            errorMessage.classList.remove('d-none');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Sign in';
        }
    });
});