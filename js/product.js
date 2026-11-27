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

    const mainImgEl = document.getElementById('prod-img');
    const thumbsListEl = document.getElementById('vertical-thumbs-list');
    const thumbPrevBtn = document.getElementById('thumb-prev-btn');
    const thumbNextBtn = document.getElementById('thumb-next-btn');
    const mainPrevBtn = document.getElementById('main-img-prev');
    const mainNextBtn = document.getElementById('main-img-next');
    const fullscreenBtn = document.getElementById('btn-fullscreen-img');

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

    function normalizeVal(v) {
        return String(v ?? '').trim().toLowerCase();
    }

    function variantMatchesCriteria(variant, criteria) {
        const attrs = variant.attributes || {};
        return Object.keys(criteria).every(key => {
            return normalizeVal(attrs[key]) === normalizeVal(criteria[key]);
        });
    }

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

        if (newIndex < 0) newIndex = galleryImages.length - 1;
        if (newIndex >= galleryImages.length) newIndex = 0;

        currentImageIndex = newIndex;
        mainImgEl.src = galleryImages[currentImageIndex];

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

        thumbsListEl.querySelectorAll('.thumb-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.imgIndex, 10);
                setActiveImageIndex(idx);
            });
        });

        if (total > VISIBLE_THUMBS) {
            thumbPrevBtn.classList.toggle('d-none', thumbWindowStart === 0);
            thumbNextBtn.classList.toggle('d-none', thumbWindowStart >= maxStart);
        } else {
            thumbPrevBtn.classList.add('d-none');
            thumbNextBtn.classList.add('d-none');
        }

        if (total > 1) {
            mainPrevBtn.classList.remove('d-none');
            mainNextBtn.classList.remove('d-none');
        } else {
            mainPrevBtn.classList.add('d-none');
            mainNextBtn.classList.add('d-none');
        }
    }

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

    // Evalúa cada botón de cada propiedad (soporta 10-20+ variantes en cualquier orden de clic)
    function updateOptionAvailability() {
        const variants = Array.isArray(currentProduct?.variants) ? currentProduct.variants : [];
        if (variants.length === 0) return;

        const inStockVariants = variants.filter(v => Number(v.stock) > 0);
        const groups = Array.from(document.querySelectorAll('.property-group'));

        // Determinar qué opciones tienen stock directo combinadas con las otras selecciones actuales
        const groupAvailability = new Map();

        groups.forEach(group => {
            const propName = group.dataset.propName;
            const buttons = Array.from(group.querySelectorAll('.property-btn'));

            const btnStates = buttons.map(btn => {
                const val = btn.dataset.propValue;
                const candidate = { ...selectedAttributes, [propName]: val };

                const directMatch = inStockVariants.some(v => variantMatchesCriteria(v, candidate));
                const anyMatch = inStockVariants.some(v =>
                    normalizeVal((v.attributes || {})[propName]) === normalizeVal(val)
                );

                return { btn, val, directMatch, anyMatch };
            });

            groupAvailability.set(propName, btnStates);
        });

        // Evitar bloqueos muertos en matrices dispersas (ej. si solo existen Roja+L y Verde+M con stock)
        groups.forEach((group, groupIndex) => {
            const propName = group.dataset.propName;
            const btnStates = groupAvailability.get(propName) || [];

            btnStates.forEach(state => {
                let isEnabled = state.directMatch;

                // Si no tiene stock directo con las otras selecciones actuales, pero sí existe en otra combinación:
                // permitir el salto solo si otra propiedad no tiene otra opción distinta activa que desbloquee esta.
                if (!isEnabled && state.anyMatch && groupIndex === 0) {
                    const otherGroupsHaveAlternative = groups.slice(1).some(otherGrp => {
                        const otherName = otherGrp.dataset.propName;
                        const otherStates = groupAvailability.get(otherName) || [];
                        return otherStates.some(
                            s => s.directMatch && normalizeVal(s.val) !== normalizeVal(selectedAttributes[otherName])
                        );
                    });

                    if (!otherGroupsHaveAlternative) {
                        isEnabled = true;
                    }
                }

                state.btn.disabled = !isEnabled;
                state.btn.classList.toggle('unavailable', !isEnabled);
                state.btn.setAttribute('aria-disabled', String(!isEnabled));
                state.btn.title = isEnabled ? '' : 'Out of stock for this combination';
            });
        });
    }

    function findMatchingVariant(changedKey = null, changedValue = null) {
        const variants = Array.isArray(currentProduct.variants) ? currentProduct.variants : [];
        if (variants.length === 0) return null;

        // 1. Coincidencia exacta con todos los atributos seleccionados (priorizando stock > 0)
        const exactInStock = variants.find(v => Number(v.stock) > 0 && variantMatchesCriteria(v, selectedAttributes));
        if (exactInStock) return exactInStock;

        const exactAny = variants.find(v => variantMatchesCriteria(v, selectedAttributes));
        if (exactAny && Number(exactAny.stock) > 0) return exactAny;

        // 2. Si se tocó una propiedad y la combinación anterior no tenía stock, saltar a la variante con stock que tenga el atributo tocado
        if (changedKey && changedValue) {
            const partialInStock = variants.find(v =>
                Number(v.stock) > 0 &&
                normalizeVal((v.attributes || {})[changedKey]) === normalizeVal(changedValue)
            );
            if (partialInStock) {
                selectedAttributes = { ...(partialInStock.attributes || {}) };
                syncPropertyButtonsUI();
                return partialInStock;
            }
        }

        return exactAny || variants.find(v => Number(v.stock) > 0) || variants[0];
    }

    function syncPropertyButtonsUI() {
        document.querySelectorAll('.property-group').forEach(group => {
            const propName = group.dataset.propName;
            const targetVal = normalizeVal(selectedAttributes[propName]);
            group.querySelectorAll('.property-btn').forEach(btn => {
                const isMatch = normalizeVal(btn.dataset.propValue) === targetVal;
                btn.classList.toggle('active', isMatch);
            });
        });
    }

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

        updateOptionAvailability();
    }

    function renderProductDetails(product) {
        currentProduct = product;
        document.title = `${product.name} - Academia`;

        document.getElementById('prod-name').textContent = product.name;
        document.getElementById('prod-desc').textContent = product.description;
        mainImgEl.alt = product.name;

        galleryImages = buildGalleryImages(product);
        currentImageIndex = 0;
        thumbWindowStart = 0;
        renderVerticalThumbnails();
        if (galleryImages.length > 0) {
            mainImgEl.src = galleryImages[0];
        }

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

        // Arrancar siempre en la primera variante que tenga stock disponible
        const variantsList = Array.isArray(product.variants) ? product.variants : [];
        const initialAvailableVariant = variantsList.find(v => Number(v.stock) > 0) || variantsList[0] || null;

        optionsToRender.forEach(opt => {
            if (!opt.name || !Array.isArray(opt.values) || opt.values.length === 0) return;

            const defaultVal = (initialAvailableVariant && initialAvailableVariant.attributes && initialAvailableVariant.attributes[opt.name])
                ? initialAvailableVariant.attributes[opt.name]
                : opt.values[0];

            selectedAttributes[opt.name] = defaultVal;

            const optionsHtml = opt.values.map(val => {
                const isActive = normalizeVal(val) === normalizeVal(defaultVal);
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

        const initialVariant = findMatchingVariant();
        applyVariantState(initialVariant);

        propertiesContainer.querySelectorAll('.property-btn').forEach(button => {
            button.addEventListener('click', function () {
                if (this.disabled) return;

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

    const btnAddCart = document.querySelector('.btn-add-cart');
    const successMsg = document.getElementById('success-msg');

    if (btnAddCart) {
        btnAddCart.addEventListener('click', async () => {
            if (btnAddCart.disabled || !currentProduct) return;

            if (selectedVariant && Number(selectedVariant.stock) <= 0) {
                alert('This variant is currently out of stock.');
                return;
            }

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
                    credentials: 'same-origin',
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
                const stillInStock = selectedVariant ? Number(selectedVariant.stock) > 0 : Number(currentProduct.stock) > 0;
                btnAddCart.disabled = !stillInStock;
                btnAddCart.innerHTML = stillInStock
                    ? originalBtnHtml
                    : '<i class="fa-solid fa-cart-shopping"></i> Out of Stock';
            }
        });
    }
});