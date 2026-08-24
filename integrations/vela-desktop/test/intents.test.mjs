import assert from "node:assert/strict";
import test from "node:test";

import {
  looksLikeImageGenerationRequest,
  messageExecutionRoute,
  needsVerifiedIdentityPipeline
} from "../renderer/intents.js";

test("recognizes explicit Chinese and English image generation requests", () => {
  assert.equal(looksLikeImageGenerationRequest("帮我生成一张白色机械狐狸的图片"), true);
  assert.equal(looksLikeImageGenerationRequest("画一幅黑白城市插画"), true);
  assert.equal(looksLikeImageGenerationRequest("Generate an image of a lunar base"), true);
  assert.equal(looksLikeImageGenerationRequest("有兽焉天禄辟邪合照"), true);
  assert.equal(looksLikeImageGenerationRequest("有兽焉中的天禄辟邪"), true);
  assert.equal(
    looksLikeImageGenerationRequest(
      "生成一张有兽焉天禄和辟邪在竹林里并肩合照，两只角色都完整出现，保持官方动画造型和各自颜色"
    ),
    true
  );
});

test("does not route ordinary image questions or negated requests to generation", () => {
  assert.equal(looksLikeImageGenerationRequest("如何生成图片？请解释原理"), false);
  assert.equal(looksLikeImageGenerationRequest("不要生成图片，只分析这段提示词"), false);
  assert.equal(looksLikeImageGenerationRequest("这张图片是什么风格？"), false);
  assert.equal(looksLikeImageGenerationRequest("介绍一下有兽焉里的天禄"), false);
});

test("recognizes identities that need strict reference lookup", () => {
  assert.equal(needsVerifiedIdentityPipeline("生成《有兽焉》天禄的二次元图片"), true);
  assert.equal(needsVerifiedIdentityPipeline("帮我画一个官方角色设定图"), true);
  assert.equal(needsVerifiedIdentityPipeline("生成一张普通雪山风景图片"), false);
});

test("routes every generation request to the dedicated local image pipeline", () => {
  assert.equal(messageExecutionRoute("生成《有兽焉》天禄的二次元图片"), "local-image");
  assert.equal(messageExecutionRoute("生成一张普通雪山风景图片"), "local-image");
  assert.equal(messageExecutionRoute("解释这张图片的构图"), "agent");
  assert.equal(messageExecutionRoute("", { imageMode: true }), "local-image");
});
