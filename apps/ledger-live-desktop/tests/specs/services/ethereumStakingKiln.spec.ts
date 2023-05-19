import test from "../../fixtures/common";
import { expect } from "@playwright/test";
import { Drawer } from "../../models/Drawer";
import { Modal } from "../../models/Modal";
import { PortfolioPage } from "../../models/PortfolioPage";
import { DiscoverPage } from "../../models/DiscoverPage";
import { MarketPage } from "../../models/MarketPage";
import { Layout } from "../../models/Layout";
import { AssetPage } from "../../models/AssetPage";
import { AccountsPage } from "../../models/AccountsPage";
import { AccountPage } from "../../models/AccountPage";
import { getProvidersMock } from "./services-api-mocks/getProviders.mock";
import { MarketCoinPage } from "../../models/MarketCoinPage";
import { Analytics } from "../../models/Analytics";

test.use({
  env: {
    SEGMENT_TEST: true,
  },
  userdata: "1AccountBTC1AccountETH",
  featureFlags: {
    stakePrograms: {
      enabled: true,
      params: {
        list: ["ethereum", "solana", "tezos", "polkadot", "tron", "cosmos", "osmo", "celo", "near"],
      },
    },
    portfolioExchangeBanner: {
      enabled: true,
    },
    stakeAccountBanner: {
      enabled: true,
      params: {
        eth: {
          kiln: true,
          lido: false,
        },
      },
    },
    ethStakingProviders: {
      enabled: true,
      params: {
        listProvider: [
          {
            id: "kiln_pooling",
            liveAppId: "kiln",
            supportLink: "#",
            minAccountBalance: 0,
            icon: "Group",
            queryParams: {
              focus: "pooled",
            },
          },
          {
            id: "kiln",
            liveAppId: "kiln",
            supportLink: "#",
            minAccountBalance: 0,
            icon: "User",
            queryParams: {
              focus: "dedicated",
            },
          },
        ],
      },
    },
  },
});

test("Ethereum staking flows via portfolio, asset page and market page", async ({ page }) => {
  const analytics = new Analytics(page);
  const portfolioPage = new PortfolioPage(page);
  const drawer = new Drawer(page);
  const modal = new Modal(page);
  const liveApp = new DiscoverPage(page);
  const assetPage = new AssetPage(page);
  const accountsPage = new AccountsPage(page);
  const accountPage = new AccountPage(page);
  const layout = new Layout(page);
  const marketPage = new MarketPage(page);
  const marketCoinPage = new MarketCoinPage(page);

  await page.route("https://swap.ledger.com/v4/providers**", async route => {
    const mockProvidersResponse = getProvidersMock();
    route.fulfill({ body: mockProvidersResponse });
  });

  await test.step("Entry buttons load with feature flag enabled", async () => {
    await expect.soft(page).toHaveScreenshot("portfolio-entry-buttons.png");
  });

  // Stake entry
  await test.step("start stake flow via Stake entry button", async () => {
    await portfolioPage.startStakeFlow();
    await drawer.waitForDrawerToBeVisible();
    await expect.soft(page).toHaveScreenshot("stake-drawer-opened-from-portfolio.png");
  });

  await test.step("choose to stake Ethereum", async () => {
    await drawer.selectCurrency("ethereum");
    await expect.soft(page).toHaveScreenshot("choose-account-panel.png");
  });

  await test.step("choose ethereum account", async () => {
    await drawer.selectAccount("Ethereum", 1);
    await expect.soft(page).toHaveScreenshot("choose-stake-provider-modal-from-portfolio-page.png");
  });

  await test.step("choose Kiln", async () => {
    const event = analytics.waitForTracking({
      event: "button_clicked",
      properties: {
        button: "kiln",
        page: "account/mock:1:ethereum:true_ethereum_1:",
      },
    });
    await modal.chooseStakeProvider("kiln");
    await event;
    await liveApp.waitForCorrectTextInWebview("Ethereum 2");
    await expect(await liveApp.getLiveAppTitle()).toBe("Kiln");
    await expect.soft(page).toHaveScreenshot("stake-provider-dapp-has-opened.png", {
      mask: [page.locator("webview")],
    });
  });

  // Asset page
  await test.step("start stake flow via Asset page", async () => {
    await layout.goToPortfolio();
    await portfolioPage.navigateToAsset("ethereum");
    await expect.soft(page).toHaveScreenshot("asset-page-with-stake-available.png");
  });

  await test.step("choose to stake Ethereum", async () => {
    await assetPage.startStakeFlow();
    await drawer.waitForDrawerToBeVisible();
    await expect.soft(page).toHaveScreenshot("stake-drawer-opened-from-asset-page.png");
  });

  await test.step("choose ethereum account", async () => {
    await drawer.selectAccount("Ethereum", 1);
    const event = analytics.waitForTracking({
      event: "button_clicked",
      properties: {
        button: "kiln_pooling",
        page: "account/mock:1:ethereum:true_ethereum_0:",
      },
    });
    await modal.chooseStakeProvider("kiln_pooling");
    await event;
    await expect
      .soft(page)
      .toHaveScreenshot("choose-stake-provider-modal-from-portfolio-page-from-asset-page.png");
  });

  // Account page
  await test.step("start stake flow via Account page", async () => {
    await layout.goToAccounts();
    await accountsPage.navigateToAccountByName("Ethereum 2");
    await expect.soft(page).toHaveScreenshot("account-page-with-stake-button-and-banner.png");
  });

  await test.step("choose to stake Ethereum via main stake button", async () => {
    await accountPage.startStakingFlowFromMainStakeButton();
    await modal.waitForModalToAppear();
    await expect.soft(page).toHaveScreenshot("choose-stake-provider-modal-from-account-page.png");
    await page.getByTestId("stake-provider-support-link-kiln");
    await page.getByTestId("stake-provider-support-link-kiln_pooling");
    await modal.close();
  });

  // Market page
  await test.step("Market page loads with ETH staking available", async () => {
    await layout.goToMarket();
    await marketPage.waitForLoading();
    await expect.soft(page).toHaveScreenshot("market-loaded-with-eth-stake-button-available.png");
  });

  await test.step("start stake flow via Stake entry button", async () => {
    await marketPage.startStakeFlowByTicker("eth");
    await drawer.waitForDrawerToBeVisible();
    await drawer.selectAccount("Ethereum", 1);
    await expect.soft(page).toHaveScreenshot("stake-modal-opened-from-market-page.png");
    await modal.close();
  });

  await test.step("Go back to Market page and start stake from ETH coin detail page", async () => {
    await layout.goToMarket();
    await marketPage.waitForLoading();
    await marketPage.openCoinPage("eth");
    await marketCoinPage.startStakeFlow();
    await drawer.waitForDrawerToBeVisible();
    await drawer.selectAccount("Ethereum", 1);
    await expect.soft(page).toHaveScreenshot("stake-modal-opened-from-market-coin-page.png");
    await modal.close();
  });
});
