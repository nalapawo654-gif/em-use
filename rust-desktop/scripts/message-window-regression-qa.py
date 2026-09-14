"""Browser regression with demo IPC; requires Vite at 127.0.0.1:5188 and Python Playwright.
This does not verify Windows native focus or a real DongDong account.
"""
import json
import tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

out = Path(tempfile.gettempdir()) / 'em-use-message-window-qa'
out.mkdir(exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 850, 'height': 550})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto('http://127.0.0.1:5188/tests/fixtures/desktop.html?scene=beaver&canvas=wide&messages=1&motion=off&random=off', wait_until='networkidle')
    trigger = page.locator('.message-launcher')
    expect(trigger).to_be_visible()
    page.screenshot(path=str(out / 'before.png'))
    page.frame_locator('iframe[name="message-toast"]').get_by_role('button', name='收起消息气泡', exact=True).click()
    # Keep the IPC pending while a second click arrives, then return a native error.
    page.evaluate('''() => {
      window.__originalOpen = window.emUse.openMessagePanel;
      window.__openCalls = 0;
      window.emUse.openMessagePanel = () => { window.__openCalls++; return new Promise((resolve, reject) => window.__rejectOpen = reject) };
    }''')
    trigger.click()
    trigger.click()
    assert page.evaluate('window.__openCalls') == 1
    page.evaluate("window.__rejectOpen('创建消息窗口失败：模拟 WebView2 错误')")
    expect(page.get_by_role('alert')).to_contain_text('模拟 WebView2 错误')
    expect(trigger).to_have_attribute('aria-expanded', 'false')
    page.screenshot(path=str(out / 'failure.png'))
    page.evaluate('() => { window.emUse.openMessagePanel = window.__originalOpen }')
    with page.expect_popup() as opened:
      trigger.click()
    card = opened.value
    card.on('pageerror', lambda e: errors.append(str(e)))
    expect(card.get_by_role('dialog', name='咚咚消息', exact=True)).to_be_visible()
    expect(card.locator('.message-detail')).to_contain_text('接口已经更新')
    card.get_by_role('button', name='打开咚咚', exact=True).click()
    assert page.evaluate('document.body.dataset.dongdongOpened') == '1'
    card.screenshot(path=str(out / 'card.png'))
    card.get_by_role('button', name='收起', exact=True).click()
    expect(trigger).to_have_attribute('aria-expanded', 'false')
    trigger.focus()
    with page.expect_popup() as reopened:
      page.keyboard.press('Enter')
    card = reopened.value
    expect(card.get_by_role('dialog', name='咚咚消息', exact=True)).to_be_visible()
    with card.expect_event('close', timeout=5000):
      try:
        card.keyboard.press('Escape')
      except Exception as error:
        if 'Target page, context or browser has been closed' not in str(error):
          raise
    expect(trigger).to_have_attribute('aria-expanded', 'false')
    # Toast failure must retain the actual native error, too.
    page.reload(wait_until='networkidle')
    page.evaluate("() => { window.emUse.openMessagePanel = async () => { throw new Error('激活消息窗口失败：模拟焦点错误') } }")
    toast = page.frame_locator('iframe[name="message-toast"]')
    toast.get_by_role('button', name='查看咚咚消息', exact=True).click()
    expect(toast.get_by_role('alert')).to_contain_text('模拟焦点错误')
    assert not errors, errors
    print(json.dumps({'beaverClick': True, 'duplicateOpenSuppressed': True, 'nativeErrorVisible': True, 'retry': True, 'closeAndReopen': True, 'keyboardAndEscape': True, 'dongdongBridge': True, 'toastErrorVisible': True, 'pageErrors': errors, 'screenshots': str(out)}, ensure_ascii=False))
    browser.close()
