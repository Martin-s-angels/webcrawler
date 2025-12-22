import 'dotenv/config'
import fs from 'fs'
import { load } from 'cheerio'
import db from './db/connection.js'
import { url } from 'inspector';

const urlsToVisit = new Set();
const visitedUrls = new Set();

const robotsCache = new Map();

const MAX_DEPTH = 2;

const MAX_PAGES = 500;
let pagesCrawled = 0;

const delay = (delayInms) => {
    return new Promise(resolve => setTimeout(resolve, delayInms));
};


async function isAllowedByRobots(url) {
    const { origin, pathname } = new URL(url);

    if (!robotsCache.has(origin)) {
        try {
            const res = await fetch(`${origin}/robots.txt`);
            robotsCache.set(origin, res.ok ? await res.text() : '');
        } catch {
            robotsCache.set(origin, '');
        }
    }

    const robots = robotsCache.get(origin);
    return !robots.includes(`Disallow: ${pathname}`);
}

async function spider() {

    const request = await db.query(`SELECT * FROM pages_not_Found ORDER BY id LIMIT 100`)


    const searchTerms = request.rows
    console.log("seach quaries in database", searchTerms)

    for (const row of searchTerms) {
        const qury = row.qury
        const searchResponse = await fetch(
            process.env.GOOGLE_API + qury + "&num=2"
        )
        const searchData = await searchResponse.json()

        if (searchData.items) {
            for (const item of searchData.items) {
                urlsToVisit.add(item.link)
            }
        }
    }

    const urlsQueue = [...urlsToVisit].map(url => ({
        url,
        depth: 0
    }));



    while (urlsQueue.length > 0) {


        const { url: currentUrl, depth } = urlsQueue.shift();

        pagesCrawled++;
        if (depth > MAX_DEPTH) {
            console.warn('ERROR: depth exceeded!', depth, currentUrl);
            continue;
        }


        visitedUrls.add(currentUrl);

        await delay(1000);

        try {
            if (!(await isAllowedByRobots(currentUrl))) continue; //respect robot 

            const response = await fetch(currentUrl, {
                headers: {
                    'User-Agent': 'MyEducationalCrawler/1.0'
                }
            });
            const result = await response.text();


            if (pagesCrawled >= MAX_PAGES) {
                console.log('Max pages reached, stopping crawl');
                break;
            }

            fs.writeFileSync("index.html", result);
            const htmlPageString = fs.readFileSync("index.html").toString();

            const $ = load(htmlPageString)
            const title = $('head > title').text().trim() || 'Untitled';
            const language = $('html').attr('lang')?.startsWith('da') ? 'da' : 'en';
            const content =
                $('#mw-content-text').text().trim() ||
                $('body').text().trim();

            const currentOrigin = new URL(currentUrl).origin;

            // find all links on the page
            const linkElements = $('a[href]').slice(0, 30);
            linkElements.each((index, element) => {
                let url = $(element).attr('href');

                if (!url.startsWith('http')) {
                    url = new URL(url, currentUrl).href;
                }

                if (url.startsWith(currentOrigin) && !url.includes('#') && !url.endsWith(".jpg") && !visitedUrls.has(url) && !urlsQueue.some(item => item.url === url)) {
                    if(depth + 1 <= MAX_DEPTH){
                        urlsQueue.push({
                            url,
                            depth: depth + 1
                        });
                    }   
                }
            })

            const inDB = await db.query(`SELECT * FROM pages where url = $1`, [currentUrl])

            if (inDB.rows.length === 0) {
                await db.query(
                    `INSERT INTO pages (title , url, language, last_updated, content)
                    VALUES ($1, $2, $3, $4, $5)`,
                    [title, currentUrl, language, new Date().toISOString(), content]
                )
            } else {
                await db.query(`UPDATE pages set last_updated = $1 where url = $2`, [new Date().toISOString(), currentUrl])
            }

        } catch (error) {
            console.error("Failed to crawl:", currentUrl, error)
        }

        console.log(`VISITING url= ${currentUrl}, VISITING depth=${depth}, queue size=${urlsQueue.length}`);
        
    };

    for (const row of searchTerms) {
        await db.query(`delete FROM pages_not_found where id = $1`, [row.id])
    }


}

spider();