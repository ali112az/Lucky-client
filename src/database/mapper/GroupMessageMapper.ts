import GroupMessage from "../entity/GroupMessage";
import xmlText from "./GroupMessageMapper.xml?raw";
import { BaseFTS5Mapper } from "../orm/BaseFTS5Mapper";
import { MessageContentType } from "@/constants";

/**
 * 群聊消息
 */
class GroupMessageMapper extends BaseFTS5Mapper<GroupMessage> {
  constructor() {
    super(GroupMessage);
    this.loadSqlByText(xmlText);
  }

  /**
   * 倒序查询消息
   * @param ownerId
   * @param groupId 群id
   * @param num 页码
   * @param size 条数
   * @returns 消息列表
   */
  findMessage(ownerId: any, groupId: any, num: any, size: any): Promise<any> {
    return this.querySql("findMessage", { groupId, ownerId, num, size });
  }

  /**
   * 最后一条消息
   * @param groupId 群id
   * @returns
   */
  async findLastMessage(groupId: any): Promise<any> {
    const res = await this.querySql("findLastMessage", { groupId });
    return res[0];
  }

  /**
   * 消息数量
   * @param groupId 群id
   * @returns
   */
  async findMessageCount(groupId: any): Promise<any> {
    const res = await this.querySql("findMessageCount", { groupId });
    return res[0]["count(*)"];
  }

  /**
   * 查询会话所有url
   * @param groupId 群id
   * @returns
   */
  findMessageUrl(groupId: any): Promise<any> {
    const imageCode = MessageContentType.IMAGE.code;
    const videoCode = MessageContentType.VIDEO.code;
    const sql = `SELECT * FROM ${this.tableName} WHERE groupId=${groupId} AND  (messageContentType= ${imageCode} or messageContentType= ${videoCode})`;
    return this.querySql(sql);
  }
}

export default GroupMessageMapper;
