import React from 'react';
import ReactDOM from 'react-dom/client';
import Aplikasi from './Aplikasi';
import './bahasa/i18n';
import './index.css';

const elemenAkar = document.getElementById('akar');

if (elemenAkar) {
  ReactDOM.createRoot(elemenAkar).render(
    <React.StrictMode>
      <Aplikasi />
    </React.StrictMode>
  );
}
