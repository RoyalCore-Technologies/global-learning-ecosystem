import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import type { CreateCommentDto } from './dto/create-comment.dto.js';
import type { UpdateCommentDto } from './dto/update-comment.dto.js';
import type { Comment } from '@platform/types';

@Injectable()
export class CommentsService {
  private readonly logger = new Logger(CommentsService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Retrieves all discussion comments for a post organized into a threaded hierarchy.
   * Pinned comments and Accepted Solutions float to the top of top-level threads.
   */
  async getPostComments(postId: string): Promise<Comment[]> {
    const client = this.databaseService.getClient();

    const { data: comments, error } = await client
      .from('comments')
      .select('*, author:author_id(id, username, display_name, avatar_url, role, verification_status)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (error) {
      this.logger.error(`Failed to fetch comments for post ${postId}: ${error.message}`);
      throw new InternalServerErrorException('Failed to retrieve discussion comments.');
    }

    if (!comments || comments.length === 0) {
      return [];
    }

    // Build comment map and organize into recursive tree
    const commentMap = new Map<string, Comment>();
    const rootComments: Comment[] = [];

    for (const raw of comments) {
      const comment: Comment = {
        ...raw,
        replies: [],
      };
      commentMap.set(comment.id, comment);
    }

    for (const comment of commentMap.values()) {
      if (comment.parent_comment_id && commentMap.has(comment.parent_comment_id)) {
        const parent = commentMap.get(comment.parent_comment_id)!;
        parent.replies = parent.replies || [];
        parent.replies.push(comment);
      } else {
        rootComments.push(comment);
      }
    }

    // Priority sorting on root threads: Pinned -> Accepted Solution -> Chronological
    rootComments.sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
      if (a.is_solution !== b.is_solution) return a.is_solution ? -1 : 1;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    return rootComments;
  }

  /**
   * Creates a new comment or threaded reply.
   */
  async createComment(
    postId: string,
    authorId: string,
    dto: CreateCommentDto
  ): Promise<Comment> {
    const client = this.databaseService.getClient();

    // 1. Verify post exists
    const { data: post, error: postErr } = await client
      .from('posts')
      .select('id, status')
      .eq('id', postId)
      .single();

    if (postErr || !post) {
      throw new NotFoundException('Target knowledge post not found.');
    }

    // 2. If parent_comment_id is specified, verify it belongs to this post
    if (dto.parent_comment_id) {
      const { data: parentComment, error: parentErr } = await client
        .from('comments')
        .select('id, post_id')
        .eq('id', dto.parent_comment_id)
        .single();

      if (parentErr || !parentComment) {
        throw new NotFoundException('The parent comment being replied to does not exist.');
      }

      if (parentComment.post_id !== postId) {
        throw new BadRequestException('Parent comment does not belong to the target post.');
      }
    }

    // 3. Insert comment
    const { data: newComment, error: insertErr } = await client
      .from('comments')
      .insert({
        post_id: postId,
        author_id: authorId,
        parent_comment_id: dto.parent_comment_id || null,
        content: dto.content.trim(),
      })
      .select('*, author:author_id(id, username, display_name, avatar_url, role, verification_status)')
      .single();

    if (insertErr || !newComment) {
      this.logger.error(`Failed to insert comment: ${insertErr?.message}`);
      throw new InternalServerErrorException('Failed to submit comment.');
    }

    return {
      ...newComment,
      replies: [],
    } as Comment;
  }

  /**
   * Updates an existing comment with strict author ownership enforcement.
   */
  async updateComment(
    commentId: string,
    userId: string,
    dto: UpdateCommentDto
  ): Promise<Comment> {
    const client = this.databaseService.getClient();

    const { data: existing, error: findErr } = await client
      .from('comments')
      .select('id, author_id')
      .eq('id', commentId)
      .single();

    if (findErr || !existing) {
      throw new NotFoundException('Comment not found.');
    }

    if (existing.author_id !== userId) {
      throw new ForbiddenException('You do not have permission to edit this comment.');
    }

    const { data: updated, error: updateErr } = await client
      .from('comments')
      .update({
        content: dto.content.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', commentId)
      .select('*, author:author_id(id, username, display_name, avatar_url, role, verification_status)')
      .single();

    if (updateErr || !updated) {
      throw new InternalServerErrorException('Failed to update comment.');
    }

    return updated as Comment;
  }

  /**
   * Deletes a comment. Permitted for comment author, post author, or platform admin.
   */
  async deleteComment(
    commentId: string,
    userId: string,
    isAdmin: boolean
  ): Promise<void> {
    const client = this.databaseService.getClient();

    const { data: comment, error: commentErr } = await client
      .from('comments')
      .select('id, author_id, post_id')
      .eq('id', commentId)
      .single();

    if (commentErr || !comment) {
      throw new NotFoundException('Comment not found.');
    }

    // Fetch post author
    const { data: post } = await client
      .from('posts')
      .select('author_id')
      .eq('id', comment.post_id)
      .single();

    const isCommentAuthor = comment.author_id === userId;
    const isPostAuthor = post?.author_id === userId;

    if (!isCommentAuthor && !isPostAuthor && !isAdmin) {
      throw new ForbiddenException('You do not have permission to delete this comment.');
    }

    const { error: deleteErr } = await client
      .from('comments')
      .delete()
      .eq('id', commentId);

    if (deleteErr) {
      throw new InternalServerErrorException('Failed to delete comment.');
    }
  }

  /**
   * Toggles pinned state for a comment. Restricted to the post author or platform admin.
   */
  async togglePin(
    commentId: string,
    userId: string,
    isAdmin: boolean
  ): Promise<{ isPinned: boolean }> {
    const client = this.databaseService.getClient();

    const { data: comment, error: commentErr } = await client
      .from('comments')
      .select('id, post_id, is_pinned')
      .eq('id', commentId)
      .single();

    if (commentErr || !comment) {
      throw new NotFoundException('Comment not found.');
    }

    const { data: post } = await client
      .from('posts')
      .select('author_id')
      .eq('id', comment.post_id)
      .single();

    if (post?.author_id !== userId && !isAdmin) {
      throw new ForbiddenException('Only the post author or an administrator may pin comments.');
    }

    const newPinned = !comment.is_pinned;
    const { error: updateErr } = await client
      .from('comments')
      .update({ is_pinned: newPinned, updated_at: new Date().toISOString() })
      .eq('id', commentId);

    if (updateErr) {
      throw new InternalServerErrorException('Failed to toggle comment pin.');
    }

    return { isPinned: newPinned };
  }

  /**
   * Marks a comment as the accepted solution. Restricted to the post author or platform admin.
   * When accepted, unsets any existing accepted solution on the post.
   */
  async toggleSolution(
    commentId: string,
    userId: string,
    isAdmin: boolean
  ): Promise<{ isSolution: boolean }> {
    const client = this.databaseService.getClient();

    const { data: comment, error: commentErr } = await client
      .from('comments')
      .select('id, post_id, is_solution')
      .eq('id', commentId)
      .single();

    if (commentErr || !comment) {
      throw new NotFoundException('Comment not found.');
    }

    const { data: post } = await client
      .from('posts')
      .select('author_id')
      .eq('id', comment.post_id)
      .single();

    if (post?.author_id !== userId && !isAdmin) {
      throw new ForbiddenException('Only the post author or an administrator may mark accepted solutions.');
    }

    const newSolution = !comment.is_solution;

    // If accepting this solution, unset any existing accepted solution for this post
    if (newSolution) {
      await client
        .from('comments')
        .update({ is_solution: false })
        .eq('post_id', comment.post_id)
        .eq('is_solution', true);
    }

    const { error: updateErr } = await client
      .from('comments')
      .update({ is_solution: newSolution, updated_at: new Date().toISOString() })
      .eq('id', commentId);

    if (updateErr) {
      throw new InternalServerErrorException('Failed to toggle accepted solution.');
    }

    return { isSolution: newSolution };
  }
}
