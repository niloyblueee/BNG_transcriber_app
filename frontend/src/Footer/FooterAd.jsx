
import React from "react";
import styles from "./FooterAd.module.css";

function FooterAd() {
  return (
    <div className={styles.footerAd}>
      <a href="https://example.com" target="_blank" rel="noopener noreferrer">
        <img 
          src="https://via.placeholder.com/468x60?text=Your+Ad+Here" 
          alt="Ad Banner" 
          className={styles.adImage}
        />
      </a>
    </div>
  );
}

export default FooterAd;

