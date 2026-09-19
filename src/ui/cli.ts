import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import 'dotenv/config';
import { BrowserManager } from '../browser/BrowserManager.js';
import { SnapshotEngine } from '../browser/SnapshotEngine.js';
import { OpenRouterClient } from '../llm/OpenRouterClient.js';
import { SecurityPolicy } from '../security/SecurityPolicy.js';
import { AgentLoop, type AgentStepRecord } from '../agent/AgentLoop.js';
import { startDashboardServer } from './server.js';

export function createCli(): Command {
  const program = new Command();

  program
    .name('agent')
    .description('Autonomous LLM-driven Web Automation Browser Agent using OpenRouter and Playwright')
    .version('1.0.0');

  // Command: agent run "<goal>"
  program
    .command('run <goal>')
    .description('Run autonomous browser agent to achieve a goal')
    .option('-u, --url <url>', 'Initial URL to navigate to')
    .option('-s, --session <id>', 'Session identifier for profile/cookie persistence')
    .option('-m, --model <model>', 'OpenRouter model (default: deepseek/deepseek-v4-flash-0731:free)')
    .option('-k, --api-key <key>', 'OpenRouter API key')
    .option('--headed', 'Run browser in visible GUI window so you can watch actions live')
    .option('--no-headless', 'Run browser in visible mode (alias for --headed)')
    .option('--slow-mo <ms>', 'Delay between browser actions in ms for easier viewing (default: 400ms when headed)')
    .option('--max-steps <number>', 'Maximum autonomous steps to take', '25')
    .option('--screenshot', 'Capture screenshots at each step', false)
    .option('--allowed-domains <domains>', 'Comma-separated allowed domains (or * for all)', '*')
    .action(async (goal: string, options: any) => {
      const apiKey = options.apiKey || process.env.OPENROUTER_API_KEY;
      if (!apiKey) {
        console.error(
          chalk.red('\n✖ Error: OPENROUTER_API_KEY is not configured.\n') +
            chalk.yellow('Please set OPENROUTER_API_KEY in .env or pass --api-key <key>.\n')
        );
        process.exit(1);
      }

      const isHeadless = options.headed
        ? false
        : (options.headless === false ? false : (process.env.HEADLESS === 'false' ? false : true));
      const slowMo = options.slowMo ? parseInt(options.slowMo, 10) : (!isHeadless ? 400 : 0);

      console.log(chalk.bold.cyan('\n🚀 Launching Autonomous Browser Agent (Free Models Mode)'));
      console.log(chalk.gray(`Goal: ${chalk.white(goal)}`));
      if (options.url) console.log(chalk.gray(`Initial URL: ${chalk.white(options.url)}`));
      console.log(chalk.gray(`Model: ${chalk.magenta(options.model || process.env.OPENROUTER_MODEL || 'deepseek/deepseek-v4-flash-0731:free')}`));
      console.log(chalk.gray(`Browser Window: ${chalk.white(!isHeadless ? 'Visible (Headed Mode)' : 'Hidden (Headless Mode)')}`));
      if (!isHeadless) console.log(chalk.gray(`SlowMo: ${chalk.white(slowMo + 'ms')}`));
      if (options.session) console.log(chalk.gray(`Session: ${chalk.white(options.session)}`));
      console.log('');

      const securityPolicy = new SecurityPolicy({
        allowedDomains: options.allowedDomains,
        maskSensitiveData: true,
      });

      const browserManager = new BrowserManager({
        headless: isHeadless,
        slowMo,
        sessionId: options.session,
      });

      const openRouterClient = new OpenRouterClient({
        apiKey,
        model: options.model,
      });

      const agent = new AgentLoop(browserManager, openRouterClient, securityPolicy);

      const spinner = ora({ text: 'Starting browser...', color: 'cyan' }).start();

      try {
        const result = await agent.run({
          goal,
          initialUrl: options.url,
          maxSteps: parseInt(options.maxSteps, 10),
          takeScreenshots: options.screenshot,
          onStep: (step: AgentStepRecord) => {
            spinner.stop();
            const stepPrefix = chalk.bold.blue(`[Step ${step.stepNumber}]`);
            const toolBadge = chalk.bgCyan.black(` ${step.toolName} `);
            const statusIcon = step.ok ? chalk.green('✔') : chalk.red('✖');

            console.log(`${stepPrefix} ${statusIcon} ${toolBadge} ${chalk.gray(JSON.stringify(step.args))}`);
            if (step.thought) {
              console.log(chalk.italic.gray(`   Thought: ${step.thought}`));
            }
            if (step.output) {
              console.log(chalk.dim(`   Output: ${step.output}`));
            }
            if (step.error) {
              console.log(chalk.red(`   Error: ${step.error}`));
            }
            if (step.screenshotPath) {
              console.log(chalk.yellow(`   Screenshot: ${step.screenshotPath}`));
            }
            console.log('');
            spinner.start('Reasoning over next action...');
          },
        });

        spinner.stop();

        if (result.success) {
          console.log(chalk.bold.green('\n🎉 Task Succeeded!'));
          console.log(chalk.bold('Summary:'), result.summary);
          console.log(chalk.bold('Final Answer:\n'), chalk.white(result.finalAnswer));
        } else {
          console.log(chalk.bold.red('\n✖ Task Failed or Stopped'));
          console.log(chalk.red('Reason:'), result.error);
        }

        console.log(chalk.dim(`\nMetrics: ${result.steps.length} steps | ${result.totalTokens} tokens | ${(result.durationMs / 1000).toFixed(1)}s`));
      } catch (err: any) {
        spinner.fail('Fatal error during execution');
        console.error(chalk.red(err?.message || err));
      } finally {
        await browserManager.close();
      }
    });

  // Command: agent snapshot <url>
  program
    .command('snapshot <url>')
    .description('Take and display an accessibility snapshot tree of a page')
    .option('--headed', 'Show visible browser window during snapshot')
    .option('--no-headless', 'Show visible browser window during snapshot')
    .action(async (url: string, options: any) => {
      const isHeadless = options.headed ? false : (options.headless === false ? false : (process.env.HEADLESS === 'false' ? false : true));
      console.log(chalk.bold.cyan(`\n📸 Inspecting Accessibility Snapshot: ${url}`));
      const browserManager = new BrowserManager({ headless: isHeadless });
      const snapshotEngine = new SnapshotEngine();
      const securityPolicy = new SecurityPolicy();

      const spinner = ora('Navigating and capturing snapshot...').start();
      try {
        const page = await browserManager.getPage();
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(1000);

        const snapshot = await snapshotEngine.takeSnapshot(page);
        spinner.succeed(chalk.green(`Snapshot v${snapshot.version} captured (${snapshot.elementCount} interactive elements)`));

        console.log('\n' + chalk.yellow('--- ARIA ACCESSIBILITY TREE ---'));
        console.log(snapshot.treeText);
        console.log(chalk.yellow('-------------------------------\n'));
      } catch (err: any) {
        spinner.fail('Failed to capture snapshot');
        console.error(chalk.red(err?.message || err));
      } finally {
        await browserManager.close();
      }
    });

  // Command: agent ui
  program
    .command('ui')
    .description('Launch the browser agent web studio frontend dashboard')
    .option('-p, --port <port>', 'Port to listen on', '3000')
    .option('--no-open', 'Do not automatically open browser')
    .action((options: any) => {
      startDashboardServer({
        port: parseInt(options.port, 10),
        openBrowser: options.open !== false,
      });
    });

  return program;
}
