// ===== CART SYSTEM =====
class CartSystem {
  constructor() {
    this.cart = JSON.parse(localStorage.getItem('bookHavenCart')) || [];
    this.init();
  }

  init() {
    this.bindEvents();
    this.updateUI();
    this.initScrollProgress();
    this.initNavbar();
    this.initTestimonials();
    this.initSearch();
    this.initMobileMenu();
    this.initScrollReveal();
    this.init3DTilt();
  }

  bindEvents() {
    // Add to cart buttons
    document.querySelectorAll('.add-cart').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const card = btn.closest('.product-card');
        const item = {
          id: btn.dataset.id,
          name: btn.dataset.name,
          price: btn.dataset.price,
          image: btn.dataset.image || card.querySelector('img').src,
          quantity: 1
        };
        this.addItem(item);
        this.animateButton(btn);
      });
    });

    // Cart toggle
    const cartIcon = document.querySelector('.cart');
    const closeCart = document.querySelector('.close-cart');
    const cartOverlay = document.querySelector('.cart-overlay');

    if (cartIcon) cartIcon.addEventListener('click', () => this.toggleCart());
    if (closeCart) closeCart.addEventListener('click', () => this.toggleCart());
    if (cartOverlay) cartOverlay.addEventListener('click', () => this.toggleCart());

    // Checkout
    const checkoutBtn = document.querySelector('.checkout-btn');
    if (checkoutBtn) {
      checkoutBtn.addEventListener('click', () => this.checkout());
    }

    // Search
    const searchTrigger = document.querySelector('.search-trigger');
    const closeSearch = document.querySelector('.close-search');
    if (searchTrigger) searchTrigger.addEventListener('click', () => this.toggleSearch());
    if (closeSearch) closeSearch.addEventListener('click', () => this.toggleSearch());

    // Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeCart();
        this.closeSearch();
      }
    });
  }

  addItem(item) {
    const exists = this.cart.find(i => i.id === item.id);
    if (exists) {
      exists.quantity++;
    } else {
      this.cart.push(item);
    }
    this.save();
    this.updateUI();
    this.showToast(`${item.name} added to cart!`);
  }

  removeItem(id) {
    this.cart = this.cart.filter(i => i.id !== id);
    this.save();
    this.updateUI();
  }

  updateQuantity(id, change) {
    const item = this.cart.find(i => i.id === id);
    if (item) {
      item.quantity += change;
      if (item.quantity < 1) {
        this.removeItem(id);
        return;
      }
      this.save();
      this.updateUI();
    }
  }

  calculateTotal() {
    return this.cart.reduce((total, item) => {
      const price = parseFloat(item.price.replace(/[$,]/g, ''));
      return total + (price * item.quantity);
    }, 0).toFixed(2);
  }

  save() {
    localStorage.setItem('bookHavenCart', JSON.stringify(this.cart));
  }

  updateUI() {
    const cartCount = document.querySelector('.cart-count');
    const cartItems = document.querySelector('.cart-items');
    const cartTotal = document.querySelector('.cart-total-price');

    // Update count
    const totalItems = this.cart.reduce((sum, item) => sum + item.quantity, 0);
    if (cartCount) {
      cartCount.textContent = totalItems;
      cartCount.classList.toggle('visible', totalItems > 0);
    }

    // Update items list
    if (cartItems) {
      if (this.cart.length === 0) {
        cartItems.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">📚</div>
            <p>Your cart is empty</p>
            <span>Time to discover your next favorite book!</span>
          </div>
        `;
      } else {
        cartItems.innerHTML = this.cart.map(item => `
          <div class="cart-item">
            <img src="${item.image}" alt="${item.name}" class="cart-item-img">
            <div class="cart-item-details">
              <span class="cart-item-name">${item.name}</span>
              <span class="cart-item-price">${item.price}</span>
              <div class="qty-controls">
                <button onclick="cart.updateQuantity('${item.id}', -1)">−</button>
                <span>${item.quantity}</span>
                <button onclick="cart.updateQuantity('${item.id}', 1)">+</button>
              </div>
            </div>
            <button class="remove-item" onclick="cart.removeItem('${item.id}')">×</button>
          </div>
        `).join('');
      }
    }

    // Update total
    if (cartTotal) {
      cartTotal.textContent = '$' + this.calculateTotal();
    }
  }

  toggleCart() {
    const cartSidebar = document.querySelector('.cart-sidebar');
    const cartOverlay = document.querySelector('.cart-overlay');
    const isOpen = cartSidebar.classList.contains('open');

    if (isOpen) {
      this.closeCart();
    } else {
      cartSidebar.classList.add('open');
      cartOverlay.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
  }

  closeCart() {
    const cartSidebar = document.querySelector('.cart-sidebar');
    const cartOverlay = document.querySelector('.cart-overlay');
    cartSidebar.classList.remove('open');
    cartOverlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  checkout() {
    if (this.cart.length === 0) {
      this.showToast('Your cart is empty!', 'error');
      return;
    }
    const total = this.calculateTotal();
    this.showToast(`Order placed! Total: $${total}`, 'success');
    this.cart = [];
    this.save();
    this.updateUI();
    setTimeout(() => this.closeCart(), 1500);
  }

  // Search functionality
  toggleSearch() {
    const modal = document.querySelector('.search-modal');
    modal.classList.toggle('active');
    if (modal.classList.contains('active')) {
      document.getElementById('searchInput').focus();
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }

  closeSearch() {
    const modal = document.querySelector('.search-modal');
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }

  initSearch() {
    const input = document.getElementById('searchInput');
    if (!input) return;

    let timeout;
    input.addEventListener('input', (e) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => this.performSearch(e.target.value), 300);
    });
  }

  performSearch(query) {
    const resultsDiv = document.querySelector('.search-results');
    if (!query.trim()) {
      resultsDiv.innerHTML = '';
      return;
    }

    // Mock search results - in real app, fetch from API
    const products = [
      { name: 'The Midnight Library', author: 'Matt Haig', price: '$14.99' },
      { name: 'Atomic Habits', author: 'James Clear', price: '$12.49' },
      { name: 'The Silent Patient', author: 'Alex Michaelides', price: '$15.99' }
    ];

    const filtered = products.filter(p => 
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.author.toLowerCase().includes(query.toLowerCase())
    );

    resultsDiv.innerHTML = filtered.map(p => `
      <div class="search-result-item">
        <div>
          <strong>${p.name}</strong>
          <span>${p.author}</span>
        </div>
        <span>${p.price}</span>
      </div>
    `).join('') || '<div class="no-results">No books found</div>';
  }

  // UI Animations
  animateButton(btn) {
    btn.innerHTML = `
      <span>Added!</span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
    `;
    btn.style.background = '#10b981';
    
    setTimeout(() => {
      btn.innerHTML = `
        <span>Add to Cart</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
          <line x1="3" y1="6" x2="21" y2="6"></line>
        </svg>
      `;
      btn.style.background = '';
    }, 1500);
  }

  showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const icon = type === 'success' ? '✓' : '✕';
    const color = type === 'success' ? '#10b981' : '#ef4444';
    
    toast.innerHTML = `
      <div class="toast-icon" style="background: ${color}">${icon}</div>
      <div class="toast-message">${message}</div>
    `;
    
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
  }

  // Navbar scroll effect
  initNavbar() {
    const navbar = document.getElementById('navbar');
    let lastScroll = 0;

    window.addEventListener('scroll', () => {
      const currentScroll = window.pageYOffset;
      
      if (currentScroll > 100) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }
      
      lastScroll = currentScroll;
    });
  }

  // Scroll progress bar
  initScrollProgress() {
    const progressBar = document.querySelector('.progress-bar');
    if (!progressBar) return;

    window.addEventListener('scroll', () => {
      const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
      const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const scrolled = (winScroll / height) * 100;
      progressBar.style.width = scrolled + '%';
    });
  }

  // Testimonials slider
  initTestimonials() {
    const testimonials = document.querySelectorAll('.testimonial');
    const dots = document.querySelectorAll('.dot');
    const prevBtn = document.querySelector('.testimonial-nav.prev');
    const nextBtn = document.querySelector('.testimonial-nav.next');
    
    if (testimonials.length === 0) return;
    
    let current = 0;
    let interval;

    const show = (index) => {
      testimonials.forEach((t, i) => {
        t.classList.toggle('active', i === index);
        dots[i].classList.toggle('active', i === index);
      });
      current = index;
    };

    const next = () => show((current + 1) % testimonials.length);
    const prev = () => show((current - 1 + testimonials.length) % testimonials.length);

    if (nextBtn) nextBtn.addEventListener('click', () => {
      next();
      resetInterval();
    });

    if (prevBtn) prevBtn.addEventListener('click', () => {
      prev();
      resetInterval();
    });

    dots.forEach((dot, i) => {
      dot.addEventListener('click', () => {
        show(i);
        resetInterval();
      });
    });

    const resetInterval = () => {
      clearInterval(interval);
      interval = setInterval(next, 5000);
    };

    interval = setInterval(next, 5000);
  }

  // Mobile menu
  initMobileMenu() {
    const toggle = document.querySelector('.mobile-menu-toggle');
    const menu = document.querySelector('.mobile-menu');
    
    if (!toggle || !menu) return;

    toggle.addEventListener('click', () => {
      menu.classList.toggle('active');
      toggle.classList.toggle('active');
    });

    // Close menu when clicking a link
    menu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        menu.classList.remove('active');
        toggle.classList.remove('active');
      });
    });
  }

  // Scroll reveal animations
  initScrollReveal() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('active');
        }
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
  }

  // 3D Tilt effect for cards
  init3DTilt() {
    if (window.matchMedia('(pointer: coarse)').matches) return; // Skip on touch devices

    document.querySelectorAll('[data-tilt]').forEach(card => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        const rotateX = (y - centerY) / 20;
        const rotateY = (centerX - x) / 20;
        
        card.querySelector('.category-card').style.transform = 
          `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
      });

      card.addEventListener('mouseleave', () => {
        const innerCard = card.querySelector('.category-card');
        innerCard.style.transform = '';
        innerCard.style.transition = 'transform 0.5s ease';
        setTimeout(() => {
          innerCard.style.transition = '';
        }, 500);
      });
    });
  }
}

// Initialize cart
const cart = new CartSystem();

// Wishlist functionality
document.querySelectorAll('.action-btn.wishlist').forEach(btn => {
  btn.addEventListener('click', function() {
    this.textContent = this.textContent === '♡' ? '♥' : '♡';
    this.style.color = this.textContent === '♥' ? '#f43f5e' : '';
    cart.showToast(this.textContent === '♥' ? 'Added to wishlist!' : 'Removed from wishlist');
  });
});