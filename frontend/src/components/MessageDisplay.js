import React, { useEffect, useRef } from 'react';

const MessageDisplay = ({ messages }) => {
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const renderMessageContent = (message) => {
    if (message.type === 'image') {
      return (
        <img 
          src={`data:image/jpeg;base64,${message.content}`}
          alt="Agent response"
          className="message-image"
        />
      );
    }
    
    return <p className="message-content">{message.content}</p>;
  };

  return (
    <div className="messages">
      {messages.map((message, index) => (
        <div 
          key={`${message.timestamp}-${index}`} 
          className={`message ${message.type}`}
        >
          {renderMessageContent(message)}
          {message.timestamp && (
            <small style={{ opacity: 0.7, fontSize: '0.8em' }}>
              {formatTimestamp(message.timestamp)}
            </small>
          )}
        </div>
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default MessageDisplay; 