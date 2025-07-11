import React, { useState, useEffect } from 'react';
import './ImageDisplay.css';

const ImageDisplay = ({ images, isVisible, onClose }) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (images.length > 0) {
      setCurrentImageIndex(images.length - 1); // Show the latest image
    }
  }, [images]);

  const handlePrevious = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    setCurrentImageIndex(prev => prev > 0 ? prev - 1 : images.length - 1);
    setTimeout(() => setIsAnimating(false), 300);
  };

  const handleNext = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    setCurrentImageIndex(prev => prev < images.length - 1 ? prev + 1 : 0);
    setTimeout(() => setIsAnimating(false), 300);
  };

  if (!isVisible || images.length === 0) {
    return null;
  }

  const currentImage = images[currentImageIndex];

  return (
    <div className={`image-display ${isVisible ? 'visible' : ''}`}>
      {/* Alternative close button - always visible in top-left */}
      <button className="alt-close-button" onClick={onClose}>
        <span className="close-icon">✕</span>
      </button>

      <div className="image-display-header">
        <div className="header-text">
          <span className="jarvis-text">GENERATED IMAGE</span>
          <span className="image-counter">{currentImageIndex + 1} / {images.length}</span>
        </div>
        <button className="close-button" onClick={onClose}>
          <span className="close-icon">✕</span>
        </button>
      </div>
      
      <div className="image-container">
        <div className={`image-wrapper ${isAnimating ? 'animating' : ''}`}>
          <img 
            src={`data:image/jpeg;base64,${currentImage.data}`}
            alt={`Generated: ${currentImage.filename}`}
            className="generated-image"
          />
          <div className="image-overlay">
            <div className="scan-line"></div>
            <div className="corner-brackets">
              <div className="bracket top-left"></div>
              <div className="bracket top-right"></div>
              <div className="bracket bottom-left"></div>
              <div className="bracket bottom-right"></div>
            </div>
          </div>
        </div>
        
        <div className="image-controls">
          <button 
            className={`nav-button prev ${images.length <= 1 ? 'hidden' : ''}`} 
            onClick={handlePrevious}
            style={{ opacity: images.length <= 1 ? 0 : 1 }}
          >
            <span>‹</span>
          </button>
          <button 
            className={`nav-button next ${images.length <= 1 ? 'hidden' : ''}`} 
            onClick={handleNext}
            style={{ opacity: images.length <= 1 ? 0 : 1 }}
          >
            <span>›</span>
          </button>
        </div>
      </div>
      
      <div className="image-info">
        <span className="filename">{currentImage.filename}</span>
        <span className="timestamp">{new Date(currentImage.timestamp).toLocaleString()}</span>
      </div>
    </div>
  );
};

export default ImageDisplay; 