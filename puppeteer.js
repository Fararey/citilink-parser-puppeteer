const puppeteer = require("puppeteer");
const fs = require("fs").promises;

const linkCatalog = "https://www.citilink.ru/catalog";

const tempFutureCateg = [
  {
    category: "смартфоны и гаджеты",
    subcategorys: [
      {
        name: "Смартфоны",
        link: "https://www.citilink.ru/catalog/smartfony/",
        items: [
          {
            title: "Смартфон Xiaomi Redmi 9A 32Gb,  серый",
            price: "10 490 ",
            image:
              "https://cdn.citilink.ru/OJOwEgyzDFPD9YDKpnuzLJvm74rx8W7x-QW1zAg0Iaw/fit/400/400/ce/false/plain/items/1402120_v01_m.jpg",
          },
        ],
      },
    ],
  },
];

// Парсит все категории
// FIXME: У подкатегорий есть подпод категории

const parseAllCategorys = async () => {
  try {
    let browser = await puppeteer.launch({
      headless: true,
      devtools: true,
      slowMo: 500,
    });

    let page = await browser.newPage();

    await page.setViewport({ width: 1400, height: 900 });
    await page.goto(linkCatalog, { waitUntil: "domcontentloaded" });

    let parsedData = await page.evaluate(async () => {
      const res = [];

      let allCategorysSelector = await document.querySelector(
        "body > div.MainWrapper > div.MainLayout.js--MainLayout.HeaderFixer > main > div > div.CatalogLayout__content"
      );
      const childrensLength = allCategorysSelector.children.length;

      for (let i = 0; i < childrensLength; i += 1) {
        const currentChild =
          allCategorysSelector.children[i].children[0].children[1];
        const categoryName = currentChild.querySelector(
          ".CatalogLayout__category-title"
        ).innerText;
        const allSubCategorys = [
          ...currentChild.querySelectorAll(
            ".CatalogLayout__children-item  > a"
          ),
        ];
        const serializedSubCategory = allSubCategorys.map((elem) => ({
          category: categoryName,
          subcategory: elem.innerText,
          link: elem.href,
          items: [],
        }));

        res.push(...serializedSubCategory);
      }

      return res;
    });

    await fs.writeFile(
      "subcategorys.json",
      JSON.stringify(parsedData),
      (err) => {
        console.log(err);
      }
    );
    setTimeout(() => {
      browser.close();
    }, 200000);
  } catch (err) {
    console.log(err);
    browser.close();
  }
};
// parseAllCategorys()

// заполняет items

const fillItems = async () => {
  try {
    const allSubCategorys = await fs
      .readFile("subcategorys.json", "utf-8")
      .then((result) => JSON.parse(result));

    let browser = await puppeteer.launch({
      headless: true,
      slowMo: 200,
    });

    let page = await browser.newPage();

    await page.setViewport({ width: 1400, height: 900 });

    let clicks = 0;

    for await (sub of allSubCategorys) {
      clicks += 1;
      console.log(clicks);
      await page.goto(sub.link, { waitUntil: "domcontentloaded" });
      if (
        page.$(
          !"body > div.MainWrapper > div.MainLayout.js--MainLayout.HeaderFixer > main > section > div.Container.Container_has-grid.ProductCardCategoryList.js--ProductCardCategoryList > div.block_data__gtm-js.block_data__pageevents-js.listing_block_data__pageevents-js.ProductCardCategoryList__products-container > div.ProductCardCategoryList__grid-container > div.ProductCardCategoryList__list > section"
        )
      ) {
        const singleRowItemSelectorButton = await page.$(
          "div.ProductCardCategoryList__view-type > label:nth-child(2) > div"
        );
        if (singleRowItemSelectorButton) {
          await singleRowItemSelectorButton.click();
          await page
            .waitForSelector(
              "body > div.MainWrapper > div.MainLayout.js--MainLayout.HeaderFixer > main > section > div.Container.Container_has-grid.ProductCardCategoryList.js--ProductCardCategoryList > div.block_data__gtm-js.block_data__pageevents-js.listing_block_data__pageevents-js.ProductCardCategoryList__products-container > div.ProductCardCategoryList__grid-container > div.ProductCardCategoryList__list > section"
            )
            .catch((e) => console.log(e));
        } else {
          console.log(sub.link);
          continue;
        }
      }

      const itemsOnPage = await page.evaluate(async () => {
        const allItemsOnPage = [
          ...document.querySelectorAll(
            "body > div.MainWrapper > div.MainLayout.js--MainLayout.HeaderFixer > main > section > div.Container.Container_has-grid.ProductCardCategoryList.js--ProductCardCategoryList > div.block_data__gtm-js.block_data__pageevents-js.listing_block_data__pageevents-js.ProductCardCategoryList__products-container > div.ProductCardCategoryList__grid-container > div.ProductCardCategoryList__list > section > div"
          ),
        ];

        return allItemsOnPage.map((item) => {
          const title = item.querySelector(
            "div.ProductCardHorizontal__header-block > a"
          )?.title;
          const price = item.querySelector(
            "span.ProductCardHorizontal__price_current-price.js--ProductCardHorizontal__price_current-price"
          )?.innerText;
          const image = item.querySelector(
            "div.ProductCardHorizontal__image-block > a > picture > source"
          )?.srcset;

          return { title, price, image };
        });
      });
      sub.items = itemsOnPage;
    }

    await fs.writeFile(
      "subcategorysWithHydratedItems.json",
      JSON.stringify(allSubCategorys),
      (err) => {
        console.log(err);
      }
    );
    console.log("done");
    setTimeout(() => {
      browser.close();
    }, 200000);
  } catch (err) {
    console.log(err);
    browser.close();
  }
};

fillItems();
