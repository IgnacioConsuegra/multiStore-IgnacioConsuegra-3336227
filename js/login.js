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

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();

        errorMessage.classList.add('d-none');
        errorMessage.textContent = '';

        const email = emailInput.value.trim();
        const password = passwordInput.value;

        const users = JSON.parse(localStorage.getItem('users')) || [];

        const foundUser = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);

        if (foundUser) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Signing in...';

            setTimeout(() => {
                localStorage.setItem('user', JSON.stringify(foundUser));

                if (foundUser.role === 'Admin') {
                    window.location.href = 'admin.html'; 
                } else {
                    window.location.href = '../index.html'; 
                }
            }, 800); 
        } else {
            errorMessage.textContent = 'Correo electrónico o contraseña incorrectos.';
            errorMessage.classList.remove('d-none');
            
            passwordInput.value = '';
        }
    });
});