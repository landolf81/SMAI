import React  from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import './enhanced-instagram.css'
import "slick-carousel/slick/slick.css"; 
import "slick-carousel/slick/slick-theme.css";
import { AuthContextProvider } from './context/AuthContext.jsx'
import './utils/logger.js' // console.log 제어



ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>

  <AuthContextProvider>
  <App />

  </AuthContextProvider>
   
    
  </React.StrictMode>,
)
