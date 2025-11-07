import fs from 'fs'
import { load } from 'cheerio'

const targetURl = "https://en.wikipedia.org/wiki/Iliad"
const urlsToVisit = [targetURl] //unvisited urls.
let currentVisitetAmount = 0

const delay = (delayInms) => {
  return new Promise(resolve => setTimeout(resolve, delayInms));
};

async function spider() {   

    while (currentVisitetAmount < urlsToVisit.length){
        //setTimeout(async () => {
            await delay(1000);

            const currentUrl = urlsToVisit[currentVisitetAmount];
            currentVisitetAmount++ 

        try {
            console.log("currently visting", currentUrl)
            const response = await fetch(currentUrl)
            const result = await response.text(); 

            fs.writeFileSync("index.html",result); 
            const htmlPageString = fs.readFileSync("index.html").toString();

            const $ = load(htmlPageString)
            const title = $('head > title').text().trim() || 'Untitled';
            const language = $('html').attr('lang')?.startsWith('da') ? 'da' : 'en';
            const content = $('#mw-content-text').text().trim();

                        // find all links on the page
            const linkElements = $('a[href]');
            linkElements.each((index, element) => {
                let url = $(element).attr('href');

                if (!url.startsWith('http')) {
                    url = new URL(url, currentUrl).href;
                }

                if (url.startsWith("https://en.wikipedia.org/wiki") && !url.includes('#')&&  !url.endsWith(".jpg") && !urlsToVisit.includes(url)) {
                    urlsToVisit.push(url);
                }
            })


        } catch (error) {

        }

        console.log(urlsToVisit)

        //}, 1);
    }; 
    
}


spider();