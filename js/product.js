document.addEventListener('DOMContentLoaded', () => {
    let currentProduct = null;
    let selectedVariant = null;
    let selectedAttributes = {};
    let quantity = 1;

    // Estado de la galería y carrusel vertical de 4 miniaturas
    let galleryImages = [];
    let currentImageIndex = 0;
    let thumbWindowStart = 0;
    const VISIBLE_THUMBS = 4;

    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');

    if (!productId) {
        window.location.href = 'not-found.html';
        return;
    }

    // Elementos de la galería
    const mainImgEl = document.getElementById('prod-img');
    const thumbsListEl = document.getElementById('vertical-thumbs-list');
    const thumbPrevBtn = document.getElementById('thumb-prev-btn');
    const thumbNextBtn = document.getElementById('thumb-next-btn');
    const mainPrevBtn = document.getElementById('main-img-prev');
    const mainNextBtn = document.getElementById('main-img-next');
    const fullscreenBtn = document.getElementById('btn-fullscreen-img');

    // 1. Consultar producto en MySQL sin caché
    fetch(`../backend/api/products.php?id=${encodeURIComponent(productId)}&t=${Date.now()}`, { cache: 'no-store' })
        .then(response => {
            if (!response.ok) throw new Error('Producto no encontrado');
            return response.json();
        })
        .then(product => {
            if (product && product.id) {
                renderProductDetails(product);
            } else {
                window.location.href = 'not-found.html';
            }
        })
        .catch(error => {
            console.error('Error cargando detalle del producto:', error);
            window.location.href = 'not-found.html';
        });

    // Construye la lista completa de imágenes (base + todas las variantes) sin duplicados
    function buildGalleryImages(product) {
        const urls = [];

        const pushUnique = (url) => {
            if (typeof url === 'string' && url.trim() !== '' && !urls.includes(url.trim())) {
                urls.push(url.trim());
            }
        };

        if (Array.isArray(product.images)) {
            product.images.forEach(pushUnique);
        }
        pushUnique(product.image);

        if (Array.isArray(product.variants)) {
            product.variants.forEach(variant => {
                if (Array.isArray(variant.images)) {
                    variant.images.forEach(pushUnique);
                }
                pushUnique(variant.image);
            });
        }

        return urls;
    }

    // Selecciona una imagen por URL o por índice y sincroniza el carrusel vertical
    function selectGalleryImageByUrl(targetUrl) {
        if (!targetUrl) return;
        const idx = galleryImages.indexOf(targetUrl);
        if (idx !== -1) {
            setActiveImageIndex(idx);
        } else {
            mainImgEl.src = targetUrl;
        }
    }

    function setActiveImageIndex(newIndex) {
        if (galleryImages.length === 0) return;

        // Carrusel circular en imagen principal
        if (newIndex < 0) newIndex = galleryImages.length - 1;
        if (newIndex >= galleryImages.length) newIndex = 0;

        currentImageIndex = newIndex;
        mainImgEl.src = galleryImages[currentImageIndex];

        // Ajustar ventana del carrusel vertical para que la miniatura activa siempre esté dentro de las 4 visibles
        if (currentImageIndex < thumbWindowStart) {
            thumbWindowStart = currentImageIndex;
        } else if (currentImageIndex >= thumbWindowStart + VISIBLE_THUMBS) {
            thumbWindowStart = currentImageIndex - VISIBLE_THUMBS + 1;
        }

        renderVerticalThumbnails();
    }

    function renderVerticalThumbnails() {
        if (!thumbsListEl) return;

        const total = galleryImages.length;
        const maxStart = Math.max(0, total - VISIBLE_THUMBS);
        thumbWindowStart = Math.min(Math.max(0, thumbWindowStart), maxStart);

        const visibleSlice = galleryImages.slice(thumbWindowStart, thumbWindowStart + VISIBLE_THUMBS);

        thumbsListEl.innerHTML = visibleSlice.map((url, localIdx) => {
            const actualIdx = thumbWindowStart + localIdx;
            const isActive = actualIdx === currentImageIndex;
            return `
                <button type="button" class="thumb-item ${isActive ? 'active' : ''}" data-img-index="${actualIdx}" aria-label="View image ${actualIdx + 1}">
                    <img src="${url}" alt="${currentProduct ? currentProduct.name : 'Product'} thumbnail ${actualIdx + 1}">
                </button>
            `;
        }).join('');

        // Eventos clic en miniaturas
        thumbsListEl.querySelectorAll('.thumb-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.imgIndex, 10);
                setActiveImageIndex(idx);
            });
        });

        // Mostrar/ocultar flechas del carrusel vertical (cuando hay más de 4 imágenes)
        if (total > VISIBLE_THUMBS) {
            thumbPrevBtn.classList.toggle('d-none', thumbWindowStart === 0);
            thumbNextBtn.classList.toggle('d-none', thumbWindowStart >= maxStart);
        } else {
            thumbPrevBtn.classList.add('d-none');
            thumbNextBtn.classList.add('d-none');
        }

        // Flechas izquierda/derecha de la imagen principal
        if (total > 1) {
            mainPrevBtn.classList.remove('d-none');
            mainNextBtn.classList.remove('d-none');
        } else {
            mainPrevBtn.classList.add('d-none');
            mainNextBtn.classList.add('d-none');
        }
    }

    // Eventos de navegación de galería
    if (thumbPrevBtn) {
        thumbPrevBtn.addEventListener('click', () => {
            if (thumbWindowStart > 0) {
                thumbWindowStart--;
                renderVerticalThumbnails();
            }
        });
    }

    if (thumbNextBtn) {
        thumbNextBtn.addEventListener('click', () => {
            const maxStart = Math.max(0, galleryImages.length - VISIBLE_THUMBS);
            if (thumbWindowStart < maxStart) {
                thumbWindowStart++;
                renderVerticalThumbnails();
            }
        });
    }

    if (mainPrevBtn) {
        mainPrevBtn.addEventListener('click', () => setActiveImageIndex(currentImageIndex - 1));
    }

    if (mainNextBtn) {
        mainNextBtn.addEventListener('click', () => setActiveImageIndex(currentImageIndex + 1));
    }

    if (fullscreenBtn) {
        fullscreenBtn.addEventListener('click', () => {
            const lightboxImg = document.getElementById('lightbox-img');
            const modalEl = document.getElementById('imageLightboxModal');
            if (lightboxImg && modalEl && mainImgEl.src) {
                lightboxImg.src = mainImgEl.src;
                const modal = new bootstrap.Modal(modalEl);
                modal.show();
            }
        });
    }

    // Busca la variante que coincide con las propiedades seleccionadas
    function findMatchingVariant(changedKey = null, changedValue = null) {
        const variants = Array.isArray(currentProduct.variants) ? currentProduct.variants : [];
        if (variants.length === 0) return null;

        // 1. Buscar coincidencia exacta con todos los atributos seleccionados
        const exactMatch = variants.find(v => {
            const attrs = v.attributes || {};
            return Object.keys(selectedAttributes).every(key => {
                return String(attrs[key] || '').toLowerCase() === String(selectedAttributes[key] || '').toLowerCase();
            });
        });

        if (exactMatch) return exactMatch;

        // 2. Si no existe esa combinación exacta, buscar la primera variante que tenga el atributo recién tocado
        if (changedKey && changedValue) {
            const partialMatch = variants.find(v => {
                const attrs = v.attributes || {};
                return String(attrs[changedKey] || '').toLowerCase() === String(changedValue).toLowerCase();
            });
            if (partialMatch) {
                // Sincronizar el resto de propiedades seleccionadas con esa variante válida
                selectedAttributes = { ...(partialMatch.attributes || {}) };
                syncPropertyButtonsUI();
                return partialMatch;
            }
        }

        return variants[0];
    }

    function syncPropertyButtonsUI() {
        document.querySelectorAll('.property-group').forEach(group => {
            const propName = group.dataset.propName;
            const targetVal = String(selectedAttributes[propName] || '').toLowerCase();
            group.querySelectorAll('.property-btn').forEach(btn => {
                const isMatch = btn.textContent.trim().toLowerCase() === targetVal;
                btn.classList.toggle('active', isMatch);
            });
        });
    }

    // Actualiza precio, stock e imagen cuando cambia la variante seleccionada
    function applyVariantState(variant) {
        selectedVariant = variant;

        const priceEl = document.getElementById('prod-price');
        const discountBadge = document.getElementById('prod-discount-badge');
        const stockLabel = document.getElementById('prod-stock');
        const addToCartBtn = document.querySelector('.btn-add-cart');
        const qtyValue = document.getElementById('qty-value');

        const activePrice = variant && variant.price !== undefined ? Number(variant.price) : Number(currentProduct.price);
        const activeOriginalPrice = variant && variant.originalPrice !== undefined ? Number(variant.originalPrice) : Number(currentProduct.originalPrice);
        const activeStock = variant && variant.stock !== undefined ? Number(variant.stock) : Number(currentProduct.stock);
        const discount = Number(currentProduct.discount || 0);

        // Precio y badge de descuento
        if (discount > 0) {
            if (discountBadge) {
                discountBadge.textContent = `-${discount}%`;
                discountBadge.classList.remove('d-none');
            }
            priceEl.innerHTML = `
                <span class="text-muted text-decoration-line-through fs-4 me-2">$${activeOriginalPrice.toFixed(2)}</span>
                <span class="text-danger">$${activePrice.toFixed(2)}</span>
            `;
        } else {
            if (discountBadge) discountBadge.classList.add('d-none');
            priceEl.textContent = `$${activePrice.toFixed(2)}`;
        }

        // Stock de la variante seleccionada
        if (activeStock > 0) {
            stockLabel.textContent = `(${activeStock} in stock)`;
            stockLabel.classList.remove('text-danger');
            stockLabel.classList.add('text-muted-custom');
            addToCartBtn.disabled = false;
            addToCartBtn.style.opacity = '1';
            addToCartBtn.innerHTML = '<i class="fa-solid fa-cart-shopping"></i> Add to Cart';

            if (quantity > activeStock) {
                quantity = activeStock;
                qtyValue.textContent = quantity;
            }
        } else {
            stockLabel.textContent = '(Out of stock)';
            stockLabel.classList.remove('text-muted-custom');
            stockLabel.classList.add('text-danger');
            addToCartBtn.disabled = true;
            addToCartBtn.style.opacity = '0.5';
            addToCartBtn.innerHTML = '<i class="fa-solid fa-cart-shopping"></i> Out of Stock';
        }

        // Cambiar imagen principal a la foto de la variante si tiene una; si no, usar la imagen base
        const variantImg = variant
            ? ((Array.isArray(variant.images) && variant.images.length > 0) ? variant.images[0] : variant.image)
            : '';
        const baseImg = (Array.isArray(currentProduct.images) && currentProduct.images.length > 0)
            ? currentProduct.images[0]
            : currentProduct.image;

        const targetImage = (variantImg && variantImg.trim() !== '') ? variantImg.trim() : baseImg;
        if (targetImage) {
            selectGalleryImageByUrl(targetImage);
        }
    }

    function renderProductDetails(product) {
        currentProduct = product;
        document.title = `${product.name} - Academia`;

        document.getElementById('prod-name').textContent = product.name;
        document.getElementById('prod-desc').textContent = product.description;
        mainImgEl.alt = product.name;

        // Construir galería completa (base + variantes) y renderizar carrusel vertical
        galleryImages = buildGalleryImages(product);
        currentImageIndex = 0;
        thumbWindowStart = 0;
        renderVerticalThumbnails();
        if (galleryImages.length > 0) {
            mainImgEl.src = galleryImages[0];
        }

        // Botones pequeños en gris con las colecciones debajo de la descripción (ignorando 'All')
        const categoriesContainer = document.getElementById('prod-categories');
        if (categoriesContainer && Array.isArray(product.categories)) {
            const visibleCategories = product.categories.filter(cat => cat.toLowerCase() !== 'all');
            categoriesContainer.innerHTML = visibleCategories.map(cat => `
                <a href="collections.html?category=${encodeURIComponent(cat)}" 
                   class="btn btn-sm btn-secondary bg-secondary-subtle text-secondary border-0 rounded-1 px-2 py-1"
                   style="font-size: 0.75rem;">
                    ${cat}
                </a>
            `).join('');
        }

        // Renderizar propiedades dinámicas (product.options o fallback a sizes/colors/materials)
        const propertiesContainer = document.getElementById('prod-properties');
        propertiesContainer.innerHTML = '';
        selectedAttributes = {};

        let optionsToRender = [];
        if (Array.isArray(product.options) && product.options.length > 0) {
            optionsToRender = product.options;
        } else {
            if (product.sizes?.length) optionsToRender.push({ name: 'Size', values: product.sizes });
            if (product.colors?.length) optionsToRender.push({ name: 'Color', values: product.colors });
            if (product.materials?.length) optionsToRender.push({ name: 'Material', values: product.materials });
        }

        // Inicializar atributos con la primera variante disponible o los primeros valores
        const firstVariant = (Array.isArray(product.variants) && product.variants.length > 0) ? product.variants[0] : null;

        optionsToRender.forEach(opt => {
            if (!opt.name || !Array.isArray(opt.values) || opt.values.length === 0) return;

            const defaultVal = (firstVariant && firstVariant.attributes && firstVariant.attributes[opt.name])
                ? firstVariant.attributes[opt.name]
                : opt.values[0];

            selectedAttributes[opt.name] = defaultVal;

            const optionsHtml = opt.values.map(val => {
                const isActive = String(val).toLowerCase() === String(defaultVal).toLowerCase();
                return `<button type="button" class="property-btn ${isActive ? 'active' : ''}" data-prop-name="${opt.name}" data-prop-value="${val}">${val}</button>`;
            }).join('');

            propertiesContainer.innerHTML += `
                <div class="property-group" data-prop-name="${opt.name}">
                    <h3 class="property-label">${opt.name}</h3>
                    <div class="d-flex gap-2 flex-wrap">
                        ${optionsHtml}
                    </div>
                </div>
            `;
        });

        // Aplicar variante inicial (actualiza imagen, precio y stock)
        const initialVariant = findMatchingVariant();
        applyVariantState(initialVariant);

        // Escuchar clics en cada botón de propiedad
        propertiesContainer.querySelectorAll('.property-btn').forEach(button => {
            button.addEventListener('click', function () {
                const propName = this.dataset.propName;
                const propValue = this.dataset.propValue;

                const siblings = this.parentElement.querySelectorAll('.property-btn');
                siblings.forEach(sib => sib.classList.remove('active'));
                this.classList.add('active');

                selectedAttributes[propName] = propValue;

                const matchedVariant = findMatchingVariant(propName, propValue);
                applyVariantState(matchedVariant);
            });
        });
    }

    // 2. Selector de cantidad respetando el stock de la variante activa
    const btnMinus = document.getElementById('btn-minus');
    const btnPlus = document.getElementById('btn-plus');
    const qtyValue = document.getElementById('qty-value');

    if (btnMinus && btnPlus) {
        btnMinus.addEventListener('click', () => {
            if (quantity > 1) {
                quantity--;
                qtyValue.textContent = quantity;
            }
        });

        btnPlus.addEventListener('click', () => {
            const maxStock = selectedVariant ? Number(selectedVariant.stock) : Number(currentProduct?.stock || 0);
            if (currentProduct && quantity < maxStock) {
                quantity++;
                qtyValue.textContent = quantity;
            }
        });
    }

    // 3. Agregar al carrito en MySQL con precio, imagen y atributos de la variante
    const btnAddCart = document.querySelector('.btn-add-cart');
    const successMsg = document.getElementById('success-msg');

    if (btnAddCart) {
        btnAddCart.addEventListener('click', async () => {
            if (btnAddCart.disabled || !currentProduct) return;

            const currentUser = JSON.parse(localStorage.getItem('user'));
            if (!currentUser || !currentUser.id) {
                alert('Please sign in to add items to your cart.');
                window.location.href = 'login.html';
                return;
            }

            const qty = parseInt(document.getElementById('qty-value').textContent, 10) || 1;
            const activePrice = selectedVariant && selectedVariant.price !== undefined
                ? Number(selectedVariant.price)
                : Number(currentProduct.price);

            const variantImg = selectedVariant
                ? ((Array.isArray(selectedVariant.images) && selectedVariant.images.length > 0) ? selectedVariant.images[0] : selectedVariant.image)
                : '';
            const activeImage = (variantImg && variantImg.trim() !== '') ? variantImg.trim() : currentProduct.image;

            const payload = {
                userId: currentUser.id,
                productId: currentProduct.id,
                variantId: selectedVariant ? selectedVariant.id : null,
                quantity: qty,
                price: activePrice,
                image: activeImage,
                attributes: selectedAttributes
            };

            const originalBtnHtml = btnAddCart.innerHTML;
            btnAddCart.disabled = true;
            btnAddCart.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Adding...';

            try {
                const response = await fetch('../backend/api/cart.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const result = await response.json();

                if (response.ok && result.status === 'success') {
                    const cartBadges = document.querySelectorAll('.cart-badge, #cart-count');
                    cartBadges.forEach(badge => {
                        badge.textContent = result.cartCount;
                        badge.classList.remove('d-none');
                    });

                    successMsg.classList.remove('d-none');
                    setTimeout(() => {
                        successMsg.classList.add('d-none');
                    }, 3000);
                } else {
                    alert(result.message || 'Could not add product to cart.');
                }
            } catch (error) {
                console.error('Error al agregar al carrito:', error);
                alert('Server connection error.');
            } finally {
                btnAddCart.disabled = false;
                btnAddCart.innerHTML = originalBtnHtml;
            }
        });
    }
});