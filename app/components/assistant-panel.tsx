"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { ArrowUpRight, Plane, RotateCcw, Trash2 } from "lucide-react";
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
    <div className="assistant-panel flex min-h-0 flex-1 flex-col">
      <div className="assistant-console-bar">
        <div className="assistant-console-bar__label">
          <span aria-hidden="true" />
          Conversation log
        </div>
        <div className="flex items-center gap-1">
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
      </div>

      <Conversation className="assistant-conversation">
        <ConversationContent className="assistant-conversation__content">
          {messages.length === 0 ? (
            <div className="assistant-empty">
              <div className="assistant-empty__status">
                <span aria-hidden="true" />
                Guide desk ready
              </div>
              <div className="assistant-empty__mark" aria-hidden="true">
                <Plane />
              </div>
              <h3>Plan with the guide</h3>
              <p>
                Ask about scores, terminals, transport, water, lounges, and
                practical tips already published on HonestAirport.
              </p>
              <div className="assistant-suggestions">
                {suggestions.map((suggestion, index) => (
                  <Suggestion
                    key={suggestion}
                    aria-label={suggestion}
                    className="assistant-suggestion"
                    onClick={() => ask(suggestion)}
                  >
                    <span aria-hidden="true">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span>{suggestion}</span>
                    <ArrowUpRight aria-hidden="true" />
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
                <Message
                  className="assistant-message"
                  from={from}
                  key={message.id}
                >
                  <div className="assistant-message__stack">
                    <span className="assistant-message__label">
                      {from === "assistant" ? "Guide desk" : "Traveler"}
                    </span>
                    <MessageContent
                      className="assistant-message__content"
                      from={from}
                    >
                      {from === "assistant" ? (
                        <MessageResponse>{text}</MessageResponse>
                      ) : (
                        <p className="whitespace-pre-wrap">{text}</p>
                      )}
                    </MessageContent>
                  </div>
                </Message>
              );
            })
          )}

          {streaming ? <Loading className="assistant-loading" /> : null}
          {error ? (
            <div role="alert" className="assistant-error">
              <p>
                {error.message ||
                  "Ask HonestAirport is unavailable right now."}
              </p>
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

      <div className="assistant-composer">
        <div className="assistant-composer__label">
          <span aria-hidden="true" />
          Field question / 800 characters
        </div>
        <PromptInput
          className="assistant-prompt"
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
        <p className="assistant-composer__note">
          Editorial guidance, not live operations. Verify terminals, hours,
          access, prices, and alerts with official sources.
        </p>
      </div>
    </div>
  );
}
