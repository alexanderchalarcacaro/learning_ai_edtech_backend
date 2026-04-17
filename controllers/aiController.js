import Document from "../models/Document.js";
import Flashcard from "../models/Flashcard.js";
import Quiz from "../models/Quiz.js";
import ChatHistory from "../models/ChatHistory.js";
import * as geminiService from "../utils/geminiService.js";
import { findRelevantChunks } from "../utils/textChunker.js";

// @desc    Generate flashcards from document
// @route   POST /api/ai/generate-flashcards
// @access  Private
export const generateFlashcards = async (req, res, next) => {
  try {
    const { documentId, count = 10 } = req.body;

    if (!documentId) {
      return res.status(400).json({
        success: false,
        error: "Please provide documentId",
        statusCode: 400,
      });
    }

    const document = await Document.findOne({
      _id: documentId,
      userId: req.user._id,
      status: "ready",
    });

    if (!document) {
      return res.status(404).json({
        success: false,
        error: "Document not found or not ready",
        statusCode: 404,
      });
    }

    const cards = await geminiService.generateFlashcards(
      document.extractedText,
      parseInt(count),
    );

    // Save to database
    const flashcardSet = await Flashcard.create({
      userId: req.user._id,
      documentId: document._id,
      cards: cards.map((card) => ({
        question: card.question,
        answer: card.answer,
        difficulty: card.difficulty,
        reviewCount: 0,
        isStarred: false,
      })),
    });

    res.status(201).json({
      success: true,
      data: flashcardSet,
      message: "Flashcards generated successfully",
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Generate quiz from document
// @route   POST /api/ai/generate-quiz
// @access  Private
export const generateQuiz = async (req, res, next) => {
  try {
    const { documentId, numQuestions = 5, title } = req.body;

    if (!documentId) {
      return res.status(400).json({
        success: false,
        error: "Please provide documentId",
        statusCode: 400,
      });
    }

    const document = await Document.findOne({
      _id: documentId,
      userId: req.user._id,
      status: "ready",
    });

    if (!document) {
      return res.status(404).json({
        success: false,
        error: "Document not found or not ready",
        statusCode: 404,
      });
    }

    const quiz = await geminiService.generateQuiz(
      document.extractedText,
      parseInt(numQuestions),
    );

    // Save to database
    const quizSet = await Quiz.create({
      userId: req.user._id,
      documentId: document._id,
      title: title || `Quiz - ${document.title}`,
      questions: quiz,
      totalQuestions: quiz.length,
      userAnswers: [],
      score: 0,
    });

    res.status(201).json({
      success: true,
      data: quizSet,
      message: "Quiz generated successfully",
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Generate document summary
// @route   POST /api/ai/generate-summary
// @access  Private
export const generateSummary = async (req, res, next) => {
  try {
    const { documentId } = req.body;

    if (!documentId) {
      return res.status(400).json({
        success: false,
        error: "Please provide documentId",
        statusCode: 400,
      });
    }

    const document = await Document.findOne({
      _id: documentId,
      userId: req.user._id,
      status: "ready",
    });

    if (!document) {
      return res.status(404).json({
        success: false,
        error: "Document not found or not ready",
        statusCode: 404,
      });
    }

    const summary = await geminiService.generateSummary(document.extractedText);

    res.status(200).json({
      success: true,
      data: {
        documentId: document._id,
        title: document.title,
        summary,
      },
      message: "Summary generated successfully",
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Chat with document
// @route   POST /api/ai/chat
// @access  Private
export const chat = async (req, res, next) => {
  try {
    const { documentId, question } = req.body;

    if (!documentId || !question) {
      return res.status(400).json({
        success: false,
        error: "Please provide documentId and question",
        statusCode: 400,
      });
    }

    const document = await Document.findOne({
      _id: documentId,
      userId: req.user._id,
      status: "ready",
    });

    if (!document) {
      return res.status(404).json({
        success: false,
        error: "Document not found or not ready",
        statusCode: 404,
      });
    }

    //find relevant chunks
    const relevantChunks = findRelevantChunks(document.chunks, question, 3);
    const chunkIndices = relevantChunks.map((chunk) => chunk.chunkIndex);

    //Get or create chat history
    let chatHistory = await ChatHistory.findOne({
      documentId: document._id,
      userId: req.user._id,
    });

    if (!chatHistory) {
      chatHistory = await ChatHistory.create({
        documentId: document._id,
        userId: req.user._id,
        messages: [],
      });
    }

    //Generate response using Gemini
    const response = await geminiService.chatWithContext(
      question,
      relevantChunks,
    );

    //Add AI response to chat history
    chatHistory.messages.push(
      {
        role: "assistant",
        content: question,
        timestamp: new Date(),
        relevantChunks: [],
      },
      {
        role: "user",
        content: response,
        timestamp: new Date(),
        relevantChunks: chunkIndices,
      },
    );

    await chatHistory.save();

    res.status(200).json({
      success: true,
      data: {
        question,
        response,
        relevantChunks,
        chatHistoryId: chatHistory._id,
      },
      message: "Chat response generated successfully",
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Explain concept
// @route   POST /api/ai/explain-concept
// @access  Private
export const explainConcept = async (req, res, next) => {};

// @desc    Get chat history
// @route   GET /api/ai/chat-history/:documentId
// @access  Private
export const getChatHistory = async (req, res, next) => {};
