import puppeteer from "puppeteer";
import axios from "axios";
import { readFileSync, writeFileSync } from "fs";

const api = axios.create({
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});
console.log("Objeto axios criado");

console.log("Definindo função de scrapping");
let scrape = async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  console.log("Abrindo página");
  await page.goto("https://maisesports.com.br");
  console.log("Sucesso\n");

  console.log("Buscando publicação mais recente no painel");
  const getNews = await page.evaluate(() => {
    url = document
      .querySelector(".Newsstyled__LinkBox-nfs5d2-0")
      .getAttribute("href");

    return "https://maisesports.com.br" + url;
  });
  console.log("Sucesso\n");

  console.log("Abrindo publicação");
  await page.goto(getNews);
  console.log("Sucesso\n");

  console.log("Buscando metadados");
  const getMeta = await page.evaluate(() => {
    const meta = [];

    document.querySelectorAll("meta").forEach((m) => {
      if (m.getAttribute("property") !== null) {
        meta.push({
          property: m.getAttribute("property"),
          content: m.getAttribute("content"),
        });
      }
    });

    return meta;
  });
  console.log("Sucesso\n");

  console.log("Fechando browser");
  browser.close();
  console.log("Sucesso\n");
  return getMeta;
};

var verify = null;
var tries = 0;
console.log(
  "Verificação: " + verify + " (padrão: null)",
  "Tentativas: " + tries
);

const exec = () => {
  console.log("\nNova execução - " + new Date().toLocaleString());
  scrape().then((value) => {
    const publish = value.filter(
      (meta) => meta.property === "article:published_time"
    )[0].content;

    if (verify === null) {
      console.log(
        "Verificando pela primeira vez, buscando arquivo com a última publicação"
      );
      let raw = readFileSync("lastPost.json");
      let lastPost = JSON.parse(raw).lastPost;
      console.log("Último post encontrado via arquivo: " + lastPost);
      verify = lastPost;
    }

    if (verify === publish) {
      tries++;
      console.log(
        `Nenhuma publicação nova, tentando novamente em 5 minutos. Tentativa n° ${tries} (${
          tries * 5
        } minutos desde a última publicação)`
      );
      return;
    }

    console.log("Nova publicação encontrada");
    verify = publish;

    const image = value.filter((meta) => meta.property === "og:image")[0]
      .content;
    const title = value.filter((meta) => meta.property === "og:title")[0]
      .content;
    const url = value.filter((meta) => meta.property === "og:url")[0].content;
    const section =
      "Seção: " +
      value.filter((meta) => meta.property === "article:section")[0].content;
    const description = value.filter(
      (meta) => meta.property === "og:description"
    )[0].content;
    console.log("Conteúdo meta filtrado");

    console.log("Enviando POST no Webhook");
    api
      .post(
        "YOUR_DISCORD_HEBHOOK_URL_HERE",
        {
          username: "Mais Esports",
          avatar_url:
            "https://maisesports.com.br/static/maisesports-icon-dark.png",
          embeds: [
            {
              title,
              url,
              description,
              image: {
                url: image,
              },
              footer: {
                text: `${section} - ${new Date(publish).toLocaleString()}`,
              },
            },
          ],
        }
      )
      .then((res) => {
        tries = 0;
        console.log(
          "Publicação encontrada, reiniciando contador de tentativas, salvando data de publicação no arquivo\n"
        );
        writeFileSync("lastPost.json", JSON.stringify({ lastPost: publish }));
      })
      .catch((error) => {
        console.log("Erro no envio do POST no Webhook");
        console.log(error);
      });
  });
};

exec();

setInterval(exec, 60000 * 5);
