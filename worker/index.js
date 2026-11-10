// Everything on the site is a static file in dist/. This Worker exists for one
// thing: Google's ownership check asks for a file at an exact ".html" address,
// and the static file server redirects ".html" addresses to the short form,
// which the check rejects. So that one address is answered here.
import verification from "./google9a419dbaecc36ed9.html";

const VERIFICATION_PATH = "/google9a419dbaecc36ed9.html";

export default {
  fetch(request, env) {
    if (new URL(request.url).pathname === VERIFICATION_PATH) {
      return new Response(verification, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }
    return env.ASSETS.fetch(request);
  },
};
