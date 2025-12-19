class MarkdownParser {
    constructor() {
        this.initializeElements();
        this.bindEvents();
        this.images = [];
    }

    initializeElements() {
        this.markdownInput = document.getElementById('markdownInput');
        this.output = document.getElementById('output');
        this.imageList = document.getElementById('imageList');
        this.toast = document.getElementById('toast');
        
        this.parseBtn = document.getElementById('parseBtn');
        this.clearBtn = document.getElementById('clearBtn');
        this.copyTextBtn = document.getElementById('copyTextBtn');
        this.downloadImagesBtn = document.getElementById('downloadImagesBtn');
        
        // 文件上传相关元素
        this.fileInput = document.getElementById('fileInput');
        this.fileNameDisplay = document.getElementById('fileNameDisplay');
        this.fileName = document.getElementById('fileName');
        this.copyTitleBtn = document.getElementById('copyTitleBtn');
        
        // 存储当前文件信息
        this.currentFile = null;
    }

    bindEvents() {
        this.parseBtn.addEventListener('click', () => this.parseMarkdown());
        this.clearBtn.addEventListener('click', () => this.clearContent());
        this.copyTextBtn.addEventListener('click', () => this.copyText());
        this.downloadImagesBtn.addEventListener('click', () => this.downloadImages());
        
        // 文件上传相关事件
        this.fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
        this.copyTitleBtn.addEventListener('click', () => this.copyTitle());
        
        this.markdownInput.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                this.parseMarkdown();
            }
        });
    }

    parseMarkdown() {
        const markdownText = this.markdownInput.value.trim();
        
        if (!markdownText) {
            this.showToast('请输入Markdown内容', 'error');
            return;
        }

        try {
            marked.setOptions({
                breaks: true,
                gfm: true,
                sanitize: false
            });

            const htmlContent = marked.parse(markdownText);
            this.output.innerHTML = htmlContent;
            this.extractImages();
            this.showToast('解析完成！');
            
        } catch (error) {
            console.error('解析错误:', error);
            this.showToast('解析失败，请检查Markdown语法', 'error');
        }
    }

    extractImages() {
        const imgElements = this.output.querySelectorAll('img');
        this.images = [];
        
        imgElements.forEach((img, index) => {
            const imageInfo = {
                src: img.src,
                alt: img.alt || `图片${index + 1}`,
                title: img.title || '',
                element: img
            };
            this.images.push(imageInfo);
        });

        this.displayImageList();
    }

    displayImageList() {
        if (this.images.length === 0) {
            this.imageList.innerHTML = '<div class="no-images">暂无图片</div>';
            this.downloadImagesBtn.disabled = true;
            return;
        }

        this.downloadImagesBtn.disabled = false;
        
        const imageListHtml = this.images.map((img, index) => `
            <div class="image-item">
                <img src="${img.src}" alt="${img.alt}" class="image-preview" 
                     onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiBmaWxsPSIjRjdGQUZDIi8+CjxwYXRoIGQ9Ik0yMCAyMEw0MCA0ME0yMCA0MEw0MCAyMCIgc3Ryb2tlPSIjQ0JEMkQ5IiBzdHJva2Utd2lkdGg9IjIiLz4KPC9zdmc+'">
                <div class="image-details">
                    <div><strong>${img.alt}</strong></div>
                    <div class="image-url">${img.src}</div>
                    ${img.title ? `<div style="font-size: 11px; color: #888; margin-top: 2px;">${img.title}</div>` : ''}
                </div>
                <button class="btn-download-single" onclick="markdownParser.downloadSingleImage(${index})" title="下载此图片">
                    📥 下载
                </button>
            </div>
        `).join('');
        
        this.imageList.innerHTML = imageListHtml;
    }

    async copyText() {
        try {
            const textContent = this.output.innerText;
            if (!textContent || textContent.includes('解析结果将显示在这里')) {
                this.showToast('没有可复制的内容', 'error');
                return;
            }

            await navigator.clipboard.writeText(textContent);
            this.showToast('纯文本内容已复制到剪贴板！');
        } catch (error) {
            console.error('复制失败:', error);
            this.fallbackCopy(this.output.innerText);
        }
    }

    fallbackCopy(text) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        
        try {
            document.execCommand('copy');
            this.showToast('内容已复制到剪贴板！');
        } catch (error) {
            this.showToast('复制失败，请手动复制', 'error');
        }
        
        document.body.removeChild(textArea);
    }

    async downloadImages() {
        if (this.images.length === 0) {
            this.showToast('没有可下载的图片', 'error');
            return;
        }

        try {
            this.showToast('正在下载图片...', 'info');
            this.downloadImagesBtn.disabled = true;
            this.downloadImagesBtn.innerHTML = '⏳ 下载中...';

            const zip = new JSZip();
            const imagePromises = [];

            this.images.forEach((img, index) => {
                const promise = this.fetchImageAsBlob(img.src)
                    .then(blob => {
                        if (blob) {
                            const extension = this.getImageExtension(img.src) || 'jpg';
                            const filename = this.sanitizeFilename(img.alt) || `image_${index + 1}`;
                            zip.file(`${filename}.${extension}`, blob);
                        }
                    })
                    .catch(error => {
                        console.warn(`下载图片失败: ${img.src}`, error);
                    });
                
                imagePromises.push(promise);
            });

            await Promise.all(imagePromises);

            const zipBlob = await zip.generateAsync({ type: 'blob' });
            const downloadLink = document.createElement('a');
            downloadLink.href = URL.createObjectURL(zipBlob);
            downloadLink.download = `markdown_images_${new Date().getTime()}.zip`;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);

            this.showToast(`成功下载 ${this.images.length} 张图片！`);

        } catch (error) {
            console.error('下载失败:', error);
            this.showToast('下载失败，请重试', 'error');
        } finally {
            this.downloadImagesBtn.disabled = false;
            this.downloadImagesBtn.innerHTML = '📥 批量下载(ZIP)';
        }
    }

    // 下载单张图片
    async downloadSingleImage(index) {
        const img = this.images[index];
        if (!img) {
            this.showToast('图片不存在', 'error');
            return;
        }

        // 检测是否为移动设备
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        try {
            const blob = await this.fetchImageAsBlob(img.src);
            if (!blob) {
                this.showToast('图片下载失败', 'error');
                return;
            }

            const extension = this.getImageExtension(img.src) || 'jpg';
            const filename = this.sanitizeFilename(img.alt) || `image_${index + 1}`;
            
            // 移动端和电脑端不同处理
            if (isMobile) {
                // 移动端：在新窗口打开图片，用户可以长按保存
                const imageUrl = URL.createObjectURL(blob);
                const newWindow = window.open('', '_blank');
                newWindow.document.write(`
                    <html>
                    <head>
                        <title>${filename}</title>
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <style>
                            body { margin: 0; padding: 20px; background: #f5f5f5; font-family: Arial, sans-serif; }
                            .container { text-align: center; }
                            img { max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
                            .tip { margin-top: 20px; padding: 15px; background: #e8f4f8; border-radius: 8px; color: #2c5aa0; }
                            .filename { font-weight: bold; margin-bottom: 15px; color: #333; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="filename">📷 ${filename}.${extension}</div>
                            <img src="${imageUrl}" alt="${img.alt}">
                            <div class="tip">
                                💡 长按图片选择"保存图片"到相册
                            </div>
                        </div>
                    </body>
                    </html>
                `);
                this.showToast('图片已在新窗口打开，长按保存');
            } else {
                // 电脑端：直接下载
                const downloadLink = document.createElement('a');
                downloadLink.href = URL.createObjectURL(blob);
                downloadLink.download = `${filename}.${extension}`;
                document.body.appendChild(downloadLink);
                downloadLink.click();
                document.body.removeChild(downloadLink);
                this.showToast(`图片 "${filename}" 下载成功！`);
            }
            
            // 延迟释放内存
            setTimeout(() => {
                URL.revokeObjectURL(imageUrl || downloadLink.href);
            }, 5000);

        } catch (error) {
            console.error('下载失败:', error);
            this.showToast('图片下载失败', 'error');
        }
    }

    async fetchImageAsBlob(url) {
        try {
            const imageUrl = url.startsWith('http') ? url : new URL(url, window.location.href).href;
            
            const response = await fetch(imageUrl, {
                mode: 'cors',
                cache: 'no-cache'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.blob();
        } catch (error) {
            console.warn(`无法获取图片: ${url}`, error);
            return null;
        }
    }

    getImageExtension(url) {
        try {
            const pathname = new URL(url).pathname;
            const extension = pathname.split('.').pop().toLowerCase();
            const validExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'];
            return validExtensions.includes(extension) ? extension : 'jpg';
        } catch (error) {
            return 'jpg';
        }
    }

    sanitizeFilename(filename) {
        if (!filename) return null;
        return filename
            .replace(/[<>:"/\\|?*]/g, '_')
            .replace(/\s+/g, '_')
            .substring(0, 50);
    }

    clearContent() {
        this.markdownInput.value = '';
        this.output.innerHTML = '<div class="placeholder">解析结果将显示在这里...</div>';
        this.images = [];
        this.displayImageList();
        this.hideFileName();
        this.showToast('内容已清空');
    }

    // 处理文件上传
    handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        // 检查文件类型
        const allowedTypes = ['text/plain', 'text/markdown'];
        const fileExtension = file.name.split('.').pop().toLowerCase();
        const allowedExtensions = ['txt', 'md', 'markdown'];

        if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
            this.showToast('只支持 txt 和 md 文件格式', 'error');
            this.fileInput.value = '';
            return;
        }

        // 检查文件大小 (限制为10MB)
        if (file.size > 10 * 1024 * 1024) {
            this.showToast('文件大小不能超过10MB', 'error');
            this.fileInput.value = '';
            return;
        }

        this.currentFile = file;
        this.readFile(file);
    }

    // 读取文件内容
    readFile(file) {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const content = e.target.result;
                this.markdownInput.value = content;
                this.showFileName(file.name);
                this.showToast(`文件 "${file.name}" 加载成功！`);
                
                // 自动解析文件内容
                this.parseMarkdown();
            } catch (error) {
                console.error('文件读取错误:', error);
                this.showToast('文件读取失败', 'error');
            }
        };

        reader.onerror = () => {
            this.showToast('文件读取失败', 'error');
        };

        reader.readAsText(file, 'UTF-8');
    }

    // 显示文件名
    showFileName(name) {
        this.fileName.textContent = name;
        this.fileNameDisplay.style.display = 'block';
    }

    // 隐藏文件名
    hideFileName() {
        this.fileNameDisplay.style.display = 'none';
        this.currentFile = null;
        this.fileInput.value = '';
    }

    // 复制标题
    async copyTitle() {
        if (!this.currentFile) {
            this.showToast('没有标题可复制', 'error');
            return;
        }

        try {
            await navigator.clipboard.writeText(this.currentFile.name);
            this.showToast('标题已复制到剪贴板！');
        } catch (error) {
            console.error('复制失败:', error);
            this.fallbackCopy(this.currentFile.name);
        }
    }

    showToast(message, type = 'success') {
        this.toast.textContent = message;
        this.toast.className = `toast ${type}`;
        this.toast.classList.add('show');
        
        setTimeout(() => {
            this.toast.classList.remove('show');
        }, 3000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.markdownParser = new MarkdownParser();
    
    const textarea = document.getElementById('markdownInput');
    textarea.addEventListener('focus', function() {
        if (!this.value) {
            this.placeholder = `试试输入一些Markdown内容：

# 这是一个标题

这是一段普通文本。

## 图片示例
![示例图片](https://via.placeholder.com/400x300/667eea/ffffff?text=示例图片)

- 列表项1
- 列表项2

**粗体文本** 和 *斜体文本*

> 这是一个引用块`;
        }
    });
});