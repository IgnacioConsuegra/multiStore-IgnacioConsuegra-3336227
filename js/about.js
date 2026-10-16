document.addEventListener('DOMContentLoaded', () => {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // 1. Obtener el id de la sección a mostrar
            const targetId = button.getAttribute('data-target');

            // 2. Remover clase 'active' de todos los botones
            tabButtons.forEach(btn => btn.classList.remove('active'));
            
            // 3. Añadir clase 'active' al botón clicado
            button.classList.add('active');

            // 4. Ocultar todas las secciones
            tabContents.forEach(content => {
                content.classList.add('d-none');
                content.classList.remove('active');
            });

            // 5. Mostrar la sección objetivo
            const targetSection = document.getElementById(targetId);
            if (targetSection) {
                targetSection.classList.remove('d-none');
                targetSection.classList.add('active');
            }
        });
    });
});