import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import { Auth0Provider } from "@auth0/auth0-react";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Auth0Provider
      domain="dev-ig7i51uf0c4fxrbb.us.auth0.com"
      clientId="Xc7mUCdeL1gidaO9L16iVIefUpKJYOib"
      authorizationParams={{
        redirect_uri: "http://localhost:5174",
      }}
      audience="http://localhost:8000"
      scope="openid profile email"
    >
      <App />
    </Auth0Provider>
  </React.StrictMode>
);
