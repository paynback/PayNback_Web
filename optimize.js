const fs = require('fs');
const path = require('path');

const dirPath = 'e:/PayNback_Web';
// Simple function to get all HTML files
function getHtmlFiles(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            // results = results.concat(getHtmlFiles(file));
        } else {
            if (file.endsWith('.html')) {
                results.push(file);
            }
        }
    });
    return results;
}

const htmlFiles = getHtmlFiles(dirPath);

function optimizeHtml(content) {
    // 1. Add defer to FontAwesome
    content = content.replace(
        /<script src="https:\/\/kit\.fontawesome\.com\/f7489ab238\.js"(?: crossorigin="anonymous")?><\/script>/g,
        '<script defer src="https://kit.fontawesome.com/f7489ab238.js" crossorigin="anonymous"></script>'
    );

    // 2. Add defer to local JS scripts in footer (js/...)
    // This regex looks for <script src="js/..."></script> not containing defer
    // Using simple approach: find all <script src="js/..."></script> and if no defer, add it.
    content = content.replace(/<script\s+src="(js\/[^"]+)"><\/script>/g, function (match, p1) {
        if (match.indexOf('defer') === -1) {
            return '<script defer src="' + p1 + '"></script>';
        }
        return match;
    });

    // 3. Delay Microsoft Clarity
    const clarityPattern = /<script type="text\/javascript">\s*\(function\(c,l,a,r,i,t,y\)\{[\s\S]*?\}\)\(window, document, "clarity", "script", "uy6h030zmk"\);\s*<\/script>/;
    const clarityNew = `<script type="text/javascript">
    window.addEventListener('load', function() {
        setTimeout(function() {
            (function(c,l,a,r,i,t,y){
                c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
            })(window, document, "clarity", "script", "uy6h030zmk");
        }, 3000);
    });
</script>`;
    content = content.replace(clarityPattern, clarityNew);

    // 4. Delay Google Tag Manager
    const gtmPattern = /<!-- Google Tag Manager -->\s*<script>\(function\(w,d,s,l,i\)\{[\s\S]*?\}\)\(window,document,'script','dataLayer','GTM-NV35WSQ6'\);<\/script>\s*<!-- End Google Tag Manager -->/;
    const gtmNew = `<!-- Google Tag Manager -->
<script>
window.addEventListener('load', function() {
    setTimeout(function() {
        (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
        new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
        j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
        'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
        })(window,document,'script','dataLayer','GTM-NV35WSQ6');
    }, 3000);
});
</script>
<!-- End Google Tag Manager -->`;
    content = content.replace(gtmPattern, gtmNew);

    // 5. Delay gtag.js
    const gtagPattern = /<!-- Google tag \(gtag\.js\) -->\s*<script async src="https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=G-S0033LD1BC"><\/script>\s*<script>\s*window\.dataLayer = window\.dataLayer \|\| \[\];\s*function gtag\(\)\{dataLayer\.push\(arguments\);\}\s*gtag\('js', new Date\(\)\);\s*gtag\('config', 'G-S0033LD1BC'\);\s*<\/script>/;
    const gtagNew = `<!-- Google tag (gtag.js) -->
<script>
window.addEventListener('load', function() {
    setTimeout(function() {
        var script = document.createElement('script');
        script.async = true;
        script.src = 'https://www.googletagmanager.com/gtag/js?id=G-S0033LD1BC';
        document.head.appendChild(script);
        
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        window.gtag = gtag;
        gtag('js', new Date());
        gtag('config', 'G-S0033LD1BC');
    }, 3000);
});
</script>`;
    content = content.replace(gtagPattern, gtagNew);

    return content;
}

let changesMade = 0;
htmlFiles.forEach(filePath => {
    const originalContent = fs.readFileSync(filePath, 'utf-8');
    const newContent = optimizeHtml(originalContent);

    if (originalContent !== newContent) {
        fs.writeFileSync(filePath, newContent, 'utf-8');
        console.log(`Updated: ${path.basename(filePath)}`);
        changesMade++;
    }
});

console.log(`Total files updated: ${changesMade}`);
