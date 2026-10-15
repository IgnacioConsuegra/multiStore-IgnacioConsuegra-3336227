fetch('../components/NavBar.html')
    .then(response => response.text())
    .then(data => {
        document.getElementById('navbar-container').innerHTML = data;
        
        // Ejecuta la lógica del NavBar ahora que los elementos ya existen en el DOM
        if (typeof initNavBar === 'function') {
            initNavBar();
        }
    })
    .catch(error => console.error("Error cargando el NavBar:", error));

fetch('../components/footer.html')
    .then(response => response.text())
    .then(data => {
        document.getElementById('footer-container').innerHTML = data;
    })
    .catch(error => console.error("Error cargando el Footer:", error));