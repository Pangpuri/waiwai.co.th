/**
 * ลงทะเบียน resolve hook ที่เข้าใจ path alias `@/*`
 * ใช้ผ่าน: node --import ./scripts/alias-hook.mjs --test "scripts/test-*.ts"
 */
import { register } from "node:module";

register(new URL("./alias-resolver.mjs", import.meta.url));
