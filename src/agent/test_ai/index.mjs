import { getClientForModel } from "../../providers/index.mjs";
import { theme } from "../../ui/theme.mjs";
import ora from "ora";

export async function testAiModel(modelValue) {
  let spinner = null;
  try {
    console.log(theme.info(`\n🧪 Testing AI model: ${modelValue}...`));
    const client = getClientForModel(modelValue);

    const maxTokens = parseInt(process.env.OUTPUT_CONTEXT_TOKENS || "1024", 10);

    spinner = ora(theme.dim('Waiting for AI response...')).start();
    const response = await client.chat.completions.create({
      model: modelValue,
      messages: [{ role: 'user', content: 'Hello, how are you? Reply with your name or a short greeting.' }],
      max_tokens: maxTokens,
    });
    if (spinner) spinner.stop();

    const reply = response.choices[0]?.message?.content || "No response received.";
    console.log(theme.success(`\n✔ AI Test Response:\n${reply}\n`));
  } catch (error) {
    if (spinner) spinner.stop();
    if (error && error.message) {
      console.log(theme.error(`\n❌ AI Test Failed: ${error.message}\n`));
    } else {
      console.log(theme.error(`\n❌ AI Test Failed.\n`));
    }
  }
}
