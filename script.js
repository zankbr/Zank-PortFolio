document.addEventListener('DOMContentLoaded', () => {
    // 1. Render Portfolio Grid
    const gridContainer = document.getElementById('portfolio-grid');
    if (gridContainer && typeof portfolioData !== 'undefined') {
        gridContainer.innerHTML = ''; // Clear container first
        // Filter out the hidden "All Works" project (id: 999)
        portfolioData.filter(p => p.id !== 999).forEach((project, index) => {
            const card = document.createElement('div');
            card.classList.add('project-card');
            card.classList.add('reveal'); // Add for scroll reveal
            card.style.transitionDelay = `${index * 0.1}s`; // Staggered delay
            
            // Extract theme from placeholder URL (simple heuristic)
            const coverStr = project.cover || '';
            const isDark = coverStr.includes('/0000ff/') || 
                          coverStr.includes('/1a1a1a/') || 
                          coverStr.includes('/000000/') ||
                          coverStr.includes('/333333/');
            card.setAttribute('data-theme', isDark ? 'dark' : 'light');

            // Check if it's a motion project with video files
            const isMotionProject = project.title === "动态视频";
            const is3DProjectCard = project.category && project.category.includes('3D');
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            
            let coverImage = project.cover;
            if (isMotionProject && isMobile && project.cover && !project.cover.includes('placehold.co')) {
                // For mobile, use webp format for motion project cover
                coverImage = project.cover.replace(/\.(mp4|webm|jpg|jpeg|png|gif)$/i, '.webp');
            }
            
            card.innerHTML = `
                <div class="card-media">
                    ${is3DProjectCard ? `<div class="card-image-placeholder"></div>` : `<img src="${coverImage}" alt="${project.title}" class="card-image">`}
                    <div class="card-overlay-text">${project.coverTitle || project.title}</div>
                </div>
                <div class="card-info">
                    <h3 class="card-title">${project.title}</h3>
                    <p class="card-category">${project.category}</p>
                </div>
            `;
            
            card.addEventListener('click', () => {
                window.location.href = `detail.html?id=${project.id}`;
            });

            // Add ripple effect on click
            card.addEventListener('mousedown', createRipple);

            gridContainer.appendChild(card);
        });
    }

    // 2. Render Detail Page
    const detailContainer = document.getElementById('detail-container');
    if (detailContainer && typeof portfolioData !== 'undefined') {
        // Get project ID from URL
        const urlParams = new URLSearchParams(window.location.search);
        const projectId = parseInt(urlParams.get('id'));

        // Find project data
        const project = portfolioData.find(p => p.id === projectId);

        if (project) {
            // Update page title dynamically
            document.title = `${project.title} | ZANKB DESIGN`;
            
            // 1. Sort images logic
            // Determine columns based on CSS breakpoints
            let columns = 3;
            if (window.innerWidth < 600) {
                columns = 2;
            }
            
            // Reorder images for "Masonry-like" visual distribution
            // CSS column-count fills vertically (Col 1 -> Col 2 -> Col 3)
            // We want visual horizontal order (Item 1 -> Top Left, Item 2 -> Top Center/Right...)
            // So we need to distribute index 0, 3, 6 to Col 1; 1, 4, 7 to Col 2; etc.
            let reorderedImages = [];
            
            // 3D Project Specific Logic (Category === '3D')
            const is3DProject = project.category && project.category.includes('3D');
            
            if (is3DProject) {
                // For 3D project: Sort by filename number prefix (1-xxx, 2-xxx)
                // This ensures "1-white" and "1-render" stay together
                const sortedImages = [...project.images].sort((a, b) => {
                    // Extract basename
                    const nameA = a.split('/').pop();
                    const nameB = b.split('/').pop();
                    
                    // Extract number prefix (e.g., "1" from "1-white.jpg")
                    const numA = parseInt(nameA.match(/^(\d+)-/) ? nameA.match(/^(\d+)-/)[1] : 9999);
                    const numB = parseInt(nameB.match(/^(\d+)-/) ? nameB.match(/^(\d+)-/)[1] : 9999);
                    
                    if (numA !== numB) return numA - numB;
                    return nameA.localeCompare(nameB); // If numbers match, sort by name
                });
                
                // For 3D PC layout, we use 4 columns (defined in CSS via .grid-3d)
                // But we still need to distribute them for Masonry flow if we want horizontal order
                // However, user asked to "ensure adjacent images stay together". 
                // With column-count: 4, adjacent items in HTML flow vertically.
                // If we want "1-white" and "1-render" to be side-by-side, we actually need horizontal flow logic.
                // BUT, user instructions for 3D are: "ensure... tight together in array" + "PC layout 4 columns".
                // If we use standard column-count, items flow down. So [1-white, 1-render, 2-white, 2-render]
                // Col 1: 1-white... Col 2: ...
                // If user wants PAIRS, maybe we shouldn't scramble them for masonry?
                // User said: "按数字从小到大...确保数字相同的两张图...在数组中紧挨着"
                // And: "PC端...4列...以便让“白模+成品”两组横向并排显示"
                // This implies visual pairing. 
                // Let's trust the sorted array order and the CSS columns. 
                // If we use the previous masonry reordering logic on this sorted array, 
                // index 0 (1-white) goes to Col 1, index 1 (1-render) goes to Col 2.
                // This puts them side-by-side horizontally! Perfect.
                
                if (window.innerWidth >= 769) {
                    columns = 4; // Override for PC 3D
                }
                
                if (sortedImages.length > 0) {
                    const cols = Array.from({ length: columns }, () => []);
                    sortedImages.forEach((img, index) => {
                        cols[index % columns].push(img);
                    });
                    cols.forEach(col => {
                        reorderedImages.push(...col);
                    });
                } else {
                    reorderedImages = [];
                }
                
            } else {
                // Standard Logic for other projects
                if (project.images && project.images.length > 0) {
                    // Distribute to columns buckets
                    const cols = Array.from({ length: columns }, () => []);
                    
                    project.images.forEach((img, index) => {
                        cols[index % columns].push(img);
                    });
                    
                    // Concatenate columns to match CSS flow order
                    cols.forEach(col => {
                        reorderedImages.push(...col);
                    });
                }
            }

            detailContainer.innerHTML = `
                <div class="detail-header reveal">
                    <h1 class="detail-title">${project.title}</h1>
                    <div class="detail-meta">
                        <span>${project.category}</span>
                    </div>
                </div>

                <div class="detail-content reveal">
                    <div class="detail-gallery ${is3DProject ? 'grid-3d' : ''}">
                        ${reorderedImages.map(img => {
                            const isVideo = img.toLowerCase().endsWith('.mp4') || img.toLowerCase().endsWith('.webm');
                            const isGif = img.toLowerCase().endsWith('.gif');
                            // User requirement: "视频预览图必须保持 WebP/图片格式，严禁改成 MP4！"
                            // So we always use image tag for preview, with data-video-src for lightbox
                            
                            let mediaElement;
                            if (isVideo) {
                                const webpPath = img.replace(/\.(mp4|webm)$/i, '.webp');
                                mediaElement = `<img src="${webpPath}" data-video-src="${img}" alt="项目视频预览" style="width:100%; display:block;">`;
                            } else if (isGif) {
                                // Always show GIFs as images
                                mediaElement = `<img src="${img}" alt="项目动图" style="width:100%; display:block;">`;
                            } else {
                                mediaElement = `<img src="${img}" alt="项目详情图">`;
                            }
                                
                            return `
                            <div class="detail-image-wrapper">
                                ${mediaElement}
                                <div class="detail-info-overlay">
                                    <div class="detail-info-content">
                                        <h3>项目介绍</h3>
                                        <p>${project.description}</p>
                                        
                                        <h3>设计理念</h3>
                                        <p>${project.concept}</p>
                                    </div>
                                </div>
                            </div>
                        `}).join('')}
                    </div>
                </div>
            `;

            // Lightbox functionality
            const lightbox = document.createElement('div');
            lightbox.className = 'lightbox';
            lightbox.innerHTML = '<span class="lightbox-close">&times;</span><div class="lightbox-content"></div>';
            document.body.appendChild(lightbox);

            const lightboxContent = lightbox.querySelector('.lightbox-content');
            const closeBtn = lightbox.querySelector('.lightbox-close');

            const closeLightbox = () => {
                lightbox.classList.remove('active');
                setTimeout(() => {
                    if (lightbox.parentNode) {
                        lightbox.parentNode.removeChild(lightbox);
                    }
                }, 300);
            };

            closeBtn.addEventListener('click', closeLightbox);
            lightbox.addEventListener('click', (e) => {
                if (e.target === lightbox) closeLightbox();
            });

            // Add Click Interaction for all gallery items
            const imageWrappers = document.querySelectorAll('.detail-image-wrapper');
            imageWrappers.forEach(wrapper => {
                wrapper.addEventListener('click', (e) => {
                    // For all devices, open lightbox directly
                    const video = wrapper.querySelector('video');
                    const img = wrapper.querySelector('img');
                    
                    lightboxContent.innerHTML = ''; // Clear previous content
                    
                    if (video) {
                        const newVideo = document.createElement('video');
                        newVideo.src = video.src;
                        newVideo.controls = true;
                        newVideo.autoplay = true;
                        newVideo.style.maxWidth = '90%';
                        newVideo.style.maxHeight = '90%';
                        lightboxContent.appendChild(newVideo);
                    } else if (img) {
                        // Check if it's a mobile placeholder for video
                        const videoSrc = img.getAttribute('data-video-src');
                        if (videoSrc) {
                            const newVideo = document.createElement('video');
                            newVideo.src = videoSrc;
                            newVideo.controls = true;
                            newVideo.autoplay = true;
                            newVideo.style.maxWidth = '90%';
                            newVideo.style.maxHeight = '90%';
                            lightboxContent.appendChild(newVideo);
                        } else {
                            const newImg = document.createElement('img');
                            newImg.src = img.src;
                            lightboxContent.appendChild(newImg);
                        }
                    }
                    
                    document.body.appendChild(lightbox); // Re-append if removed
                    setTimeout(() => lightbox.classList.add('active'), 10);
                });
            });
        } else {
            detailContainer.innerHTML = `
                <div style="height: 50vh; display: flex; flex-direction: column; justify-content: center; align-items: center;">
                    <h1>未找到该项目</h1>
                    <a href="index.html" style="margin-top: 2rem; text-decoration: underline;">返回首页</a>
                </div>
            `;
        }
    }

    // Mobile Avatar Interaction
    const avatarWrapper = document.querySelector('.avatar-wrapper');
    if (avatarWrapper) {
        avatarWrapper.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                avatarWrapper.classList.toggle('mobile-active');
            }
        });
    }

    // 3. Scroll Reveal Animation
    const reveals = document.querySelectorAll('.reveal');

    const revealOnScroll = () => {
        const windowHeight = window.innerHeight;
        const elementVisible = 150;

        reveals.forEach((reveal) => {
            const elementTop = reveal.getBoundingClientRect().top;

            if (elementTop < windowHeight - elementVisible) {
                reveal.classList.add('active');
            }
        });
    };

    window.addEventListener('scroll', revealOnScroll);
    // Trigger once on load/render (setTimeout to ensure dynamic content is rendered)
    setTimeout(revealOnScroll, 100);

    // 4. Ripple Effect for all clickable elements
    // Select initial buttons
    const buttons = document.querySelectorAll('button, a, .nav-links a');
    buttons.forEach(btn => {
        btn.addEventListener('mousedown', createRipple);
    });

    function createRipple(event) {
        const element = event.currentTarget;
        
        // Only apply if position is relative or absolute, otherwise ripple won't be contained
        const style = window.getComputedStyle(element);
        if (style.position === 'static') {
            element.style.position = 'relative';
        }
        
        // Remove existing ripples
        const existingRipple = element.querySelector('.ripple');
        if (existingRipple) {
            existingRipple.remove();
        }

        const circle = document.createElement('span');
        const diameter = Math.max(element.clientWidth, element.clientHeight);
        const radius = diameter / 2;

        const rect = element.getBoundingClientRect();
        
        circle.style.width = circle.style.height = `${diameter}px`;
        circle.style.left = `${event.clientX - rect.left - radius}px`;
        circle.style.top = `${event.clientY - rect.top - radius}px`;
        circle.classList.add('ripple');

        element.appendChild(circle);
    }

    // 5. Smooth Scroll for Anchor Links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();

            const targetId = this.getAttribute('href').substring(1);
            if (!targetId) return; // Handle empty hash

            const targetElement = document.getElementById(targetId);

            if (targetElement) {
                const headerOffset = 100;
                const elementPosition = targetElement.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.scrollY - headerOffset;

                window.scrollTo({
                    top: offsetPosition,
                    behavior: "smooth"
                });
            }
        });
    });

    // 6. Social Links Interaction
    const socialLinksContainer = document.querySelector('.social-links');
    if (socialLinksContainer) {
        const socialLinks = socialLinksContainer.querySelectorAll('a');
        const originalTexts = Array.from(socialLinks).map(link => link.textContent);

        // Create a container for the prompt message
        const promptContainer = document.createElement('div');
        promptContainer.style.position = 'absolute';
        promptContainer.style.top = '50%';
        promptContainer.style.left = '50%';
        promptContainer.style.transform = 'translate(-50%, -50%)';
        promptContainer.style.fontSize = '1.2rem';
        promptContainer.style.fontWeight = '700';
        promptContainer.style.textAlign = 'center';
        promptContainer.style.display = 'none';
        socialLinksContainer.style.position = 'relative';
        socialLinksContainer.appendChild(promptContainer);

        // Function to show prompt and hide links
        function showPrompt(message) {
            socialLinks.forEach(link => {
                link.style.opacity = '0';
                link.style.pointerEvents = 'none';
            });
            promptContainer.textContent = message;
            promptContainer.style.display = 'block';

            // Add click listener to document to restore links
            function restoreLinks() {
                socialLinks.forEach((link, index) => {
                    link.style.opacity = '1';
                    link.style.pointerEvents = 'auto';
                });
                promptContainer.style.display = 'none';
                document.removeEventListener('click', restoreLinks);
            }

            setTimeout(() => {
                document.addEventListener('click', restoreLinks);
            }, 100);
        }

        // Add click listeners to social links
        socialLinks.forEach((link, index) => {
            link.addEventListener('click', (e) => {
                e.stopPropagation();
                switch (originalTexts[index]) {
                    case 'PHONE':
                        showPrompt('请给我发邮件询问');
                        break;
                    case 'WECHAT':
                        showPrompt('请给我打电话询问');
                        break;
                    case 'TIKTOK':
                        showPrompt('请给我发微信询问');
                        break;
                }
            });
        });
    }

    // 7. Email Spoiler Interaction (Using Event Delegation for Dynamic Content)
    document.body.addEventListener('click', function(e) {
        const emailWrapper = e.target.closest('.email-spoiler-wrapper');
        if (emailWrapper) {
            // Prevent default if it's the first click to reveal
            if (!emailWrapper.classList.contains('revealed')) {
                e.preventDefault(); // Stop link navigation if user clicked directly on link
                e.stopPropagation();
                
                emailWrapper.classList.add('revealed');
                const emailLink = emailWrapper.querySelector('.contact-email');
                if (emailLink) {
                    emailLink.classList.remove('spoiler-hidden');
                }
            }
            // If already revealed, let the click pass through to the mailto link
        }
    });
});
