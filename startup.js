document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('urlForm');
    const urlInput = document.getElementById('posUrl');
    const loadButton = document.getElementById('loadButton');
    const buttonText = document.querySelector('.button-text');
    const spinner = document.querySelector('.spinner');
    const examples = document.querySelectorAll('.example');


    urlInput.value = 'http://192.168.6.208:8069/pos/ui?config_id=1';


    examples.forEach(example => {
        example.addEventListener('click', function() {
            const url = this.dataset.url;
            urlInput.value = url;
            urlInput.focus();
            
            examples.forEach(ex => ex.style.transform = 'scale(1)');
            this.style.transform = 'scale(1.02)';
            setTimeout(() => {
                this.style.transform = 'scale(1)';
            }, 200);
        });
    });

    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const url = urlInput.value.trim();
        
        if (!url) {
            showError('Please enter a valid URL');
            return;
        }

        try {
            new URL(url);
        } catch (error) {
            showError('Please enter a valid URL format');
            return;
        }

        setLoadingState(true);
        
        if (window.electronAPI && window.electronAPI.loadPosUrl) {
            window.electronAPI.loadPosUrl(url).then(() => {
                console.log('POS URL loaded successfully');
            }).catch(error => {
                console.error('Failed to load POS URL:', error);
                showError('Failed to load the POS application. Please check the URL and try again.');
                setLoadingState(false);
            });
        } else {
            setTimeout(() => {
                console.log('Would load URL:', url);
                setLoadingState(false);
            }, 2000);
        }
    });

    urlInput.addEventListener('input', function() {
        clearError();
    });

    function setLoadingState(loading) {
        if (loading) {
            loadButton.disabled = true;
            loadButton.classList.add('loading');
            buttonText.textContent = 'Loading...';
            spinner.style.display = 'block';
        } else {
            loadButton.disabled = false;
            loadButton.classList.remove('loading');
            buttonText.textContent = 'Load App';
            spinner.style.display = 'none';
        }
    }

    function showError(message) {
        urlInput.classList.add('error');
        
        let errorDiv = document.querySelector('.error-message');
        if (!errorDiv) {
            errorDiv = document.createElement('div');
            errorDiv.className = 'error-message';
            urlInput.parentNode.appendChild(errorDiv);
        }
        
        errorDiv.textContent = message;
        errorDiv.classList.add('show');
        
        urlInput.focus();
        urlInput.select();
    }

    function clearError() {
        urlInput.classList.remove('error');
        const errorDiv = document.querySelector('.error-message');
        if (errorDiv) {
            errorDiv.classList.remove('show');
        }
    }

    // Auto-focus the input when page loads
    setTimeout(() => {
        urlInput.focus();
    }, 500);
});
