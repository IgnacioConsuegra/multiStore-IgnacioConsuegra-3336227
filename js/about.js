document.addEventListener('DOMContentLoaded', () => {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetId = button.getAttribute('data-target');

            tabButtons.forEach(btn => btn.classList.remove('active'));
            
            button.classList.add('active');

            tabContents.forEach(content => {
                content.classList.add('d-none');
                content.classList.remove('active');
            });

            const targetSection = document.getElementById(targetId);
            if (targetSection) {
                targetSection.classList.remove('d-none');
                targetSection.classList.add('active');
            }
        });
    });
});