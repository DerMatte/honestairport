"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { HonestAirportAssistantMessage } from "@/lib/assistant/honest-airport-agent";
import {
  Conversation,
  ConversationContent,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import { Loading } from "@/components/ai-elements/loading";
import {
  PromptInput,
  PromptInputAction,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Suggestion } from "@/components/ai-elements/suggestion";
import { Button } from "@/components/ui/button";

const transport = new DefaultChatTransport({ api: "/api/assistant" });

const suggestions = [
  "What should I know before a layover at JFK?",
  "Compare Heathrow and Schiphol using HonestAirport's guides and scores.",
  "How do I get from SIN to the city, and what details should I verify?",
];

export default function AssistantPanel() {
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const {
    messages,
    sendMessage,
    status,
    error,
    stop,
    regenerate,
    setMessages,
    clearError,
  } = useChat<HonestAirportAssistantMessage>({ transport });
  const streaming = status === "submitted" || status === "streaming";

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, status]);

  function ask(text: string) {
    const question = text.trim();
    if (!question || streaming) return;
    clearError();
    void sendMessage({ text: question });
    setInput("");
  }

  function clearConversation() {
    if (streaming) stop();
    setMessages([]);
    clearError();
    setInput("");
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-end gap-1 border-b border-border/60 px-3 py-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={messages.length === 0 || streaming}
          onClick={() => void regenerate()}
        >
          <RotateCcw aria-hidden="true" />
          Retry
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={messages.length === 0 && !error}
          onClick={clearConversation}
        >
          <Trash2 aria-hidden="true" />
          Clear
        </Button>
      </div>

      <Conversation>
        <ConversationContent>
          {messages.length === 0 ? (
            <div className="mx-auto flex max-w-sm flex-col items-center py-6 text-center">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-xl" aria-hidden="true">
                ✈
              </div>
              <h3 className="mt-4 font-heading text-xl font-medium">Plan with the guide, not guesswork</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Ask about Airportist Scores, terminals, transport, water, lounges,
                and practical tips already published on HonestAirport.
              </p>
              <div className="mt-5 grid w-full gap-2">
                {suggestions.map((suggestion) => (
                  <Suggestion key={suggestion} onClick={() => ask(suggestion)}>
                    {suggestion}
                  </Suggestion>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message) => {
              const text = message.parts
                .filter((part): part is Extract<typeof part, { type: "text" }> => part.type === "text")
                .map((part) => part.text)
                .join("");

              if (!text) return null;
              const from = message.role === "user" ? "user" : "assistant";
              return (
                <Message from={from} key={message.id}>
                  <MessageContent from={from}>
                    {from === "assistant" ? (
                      <MessageResponse>{text}</MessageResponse>
                    ) : (
                      <p className="whitespace-pre-wrap">{text}</p>
                    )}
                  </MessageContent>
                </Message>
              );
            })
          )}

          {streaming ? <Loading /> : null}
          {error ? (
            <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <p>{error.message || "Ask HonestAirport is unavailable right now."}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => void regenerate()}
              >
                Try again
              </Button>
            </div>
          ) : null}
          <div ref={endRef} />
        </ConversationContent>
      </Conversation>

      <div className="border-t border-border/60 bg-background p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <PromptInput
          onSubmit={(event) => {
            event.preventDefault();
            ask(input);
          }}
        >
          <PromptInputTextarea
            autoFocus
            aria-label="Ask HonestAirport"
            maxLength={800}
            placeholder="Ask about an airport…"
            value={input}
            onChange={(event) => setInput(event.currentTarget.value)}
          />
          <PromptInputAction
            streaming={streaming}
            disabled={!streaming && !input.trim()}
            onClick={streaming ? stop : undefined}
          />
        </PromptInput>
        <p className="mt-2 px-1 text-[11px] leading-4 text-muted-foreground">
          Guide-based, not live. Verify terminals, hours, access, prices, and alerts with official sources.
        </p>
      </div>
    </div>
  );
}
